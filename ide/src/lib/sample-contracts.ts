export interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

export const sampleContracts: FileNode[] = [
  {
    name: "hello_world",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: `#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Say hello to someone.
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        env.events().publish((symbol_short!("greeting"),), to.clone());
        vec![&env, symbol_short!("Hello"), to]
    }

    /// Example with potentially unsafe math operations
    pub fn unsafe_math(env: Env, a: u64, b: u64) -> u64 {
        // These operations could overflow on ledger
        let sum = a + b;  // MATH001: Potentially unsafe addition
        let product = a * b;  // MATH001: Potentially unsafe multiplication
        let difference = a - b;  // MATH001: Potentially unsafe subtraction

        // Large number operations
        let big_amount: u128 = 1000000;
        let result = big_amount * a;  // MATH001: Potentially unsafe multiplication

        sum + product
    }
}

mod test;`,
      },
      {
        name: "test.rs",
        type: "file",
        language: "rust",
        content: `#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, vec, Env};

#[test]
fn test_hello() {
    let env = Env::default();
    let contract_id = env.register_contract(None, HelloContract);
    let client = HelloContractClient::new(&env, &contract_id);

    let words = client.hello(&symbol_short!("Dev"));
    assert_eq!(
        words,
        vec![&env, symbol_short!("Hello"), symbol_short!("Dev")]
    );

    use soroban_sdk::testutils::Events as _;
    let events = env.events().all();
    assert!(events.iter().any(|(_, topics, _)| {
        topics.contains(symbol_short!("greeting").into())
    }));
}`,
      },
      {
        name: "Cargo.toml",
        type: "file",
        language: "toml",
        content: `[package]
name = "hello-world"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }`,
      },
    ],
  },
  {
    name: "token",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: `#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    Balance(Address),
}

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
    ) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap()
    }

    pub fn balance(env: Env, address: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(address))
            .unwrap_or(0i128)
    }

    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }
        let balance_key = DataKey::Balance(to.clone());
        let current_balance: i128 = env.storage().instance().get(&balance_key).unwrap_or(0i128);
        env.storage().instance().set(&balance_key, &(current_balance + amount));
    }

    pub fn set_admin(env: Env, admin: Address, new_admin: Address) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }
}

mod test;`,
      },
      {
        name: "test.rs",
        type: "file",
        language: "rust",
        content: `#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_token_mint_and_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let name = String::from_str(&env, "Test Token");
    let symbol = String::from_str(&env, "TST");

    client.initialize(&admin, &7, &name, &symbol);

    assert_eq!(client.decimals(), 7);

    // Mint tokens (admin required)
    client.mint(&admin, &alice, &1000);
    assert_eq!(client.balance(&alice), 1000);

    // Set admin (admin required)
    let new_admin = Address::generate(&env);
    client.set_admin(&admin, &new_admin);

    // Non-admin attempt should panic (bypass prevention verification)
    let res = std::panic::catch_unwind(|| {
        let env_inner = Env::default();
        env_inner.mock_all_auths();
        let c_id = env_inner.register_contract(None, TokenContract);
        let c_client = TokenContractClient::new(&env_inner, &c_id);
        let adm = Address::generate(&env_inner);
        let ali = Address::generate(&env_inner);
        let nm = String::from_str(&env_inner, "Test Token");
        let sym = String::from_str(&env_inner, "TST");
        c_client.initialize(&adm, &7, &nm, &sym);
        // Try to mint with non-admin (ali)
        c_client.mint(&ali, &ali, &100);
    });
    assert!(res.is_err());
  }`,
      },
      {
        name: "Cargo.toml",
        type: "file",
        language: "toml",
        content: `[package]
name = "token-sample"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }`,
      },
    ],
  },
  {
    name: "increment",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, log, Env};

#[contracttype]
pub enum DataKey {
    Counter,
}

#[contract]
pub struct IncrementContract;

#[contractimpl]
impl IncrementContract {
    /// Increment an internal counter and return the value.
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0);

        count += 1;

        log!(&env, "count: {}", count);

        env.storage()
            .instance()
            .set(&DataKey::Counter, &count);

        env.storage().instance().extend_ttl(100, 100);

        count
    }

    /// Return the current value of the counter.
    pub fn get_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Counter)
            .unwrap_or(0)
    }
}`,
      },
    ],
  },
  {
    name: "cross_contract",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct CalleeContract;

#[contractimpl]
impl CalleeContract {
    pub fn add(env: Env, a: u32, b: u32) -> u32 {
        a + b
    }
}

#[contract]
pub struct CallerContract;

#[contractimpl]
impl CallerContract {
    pub fn call_add(env: Env, callee_id: Address, a: u32, b: u32) -> u32 {
        let client = CalleeContractClient::new(&env, &callee_id);
        client.add(&a, &b)
    }
}

mod test;`,
      },
      {
        name: "test.rs",
        type: "file",
        language: "rust",
        content: `#![cfg(test)]

use super::*;
use soroban_sdk::Env;

#[test]
fn test_cross_contract_call() {
    let env = Env::default();
    
    let callee_id = env.register_contract(None, CalleeContract);
    let caller_id = env.register_contract(None, CallerContract);
    let caller_client = CallerContractClient::new(&env, &caller_id);
    
    let result = caller_client.call_add(&callee_id, &5, &7);
    assert_eq!(result, 12);
}`,
      },
      {
        name: "Cargo.toml",
        type: "file",
        language: "toml",
        content: `[package]
name = "cross-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }`,
      },
    ],
  },
  {
    name: "timelocked_escrow",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowState {
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub unlock_time: u64,
    pub claimed: bool,
}

#[contracttype]
pub enum DataKey {
    State,
}

#[contract]
pub struct EscrowVestingContract;

#[contractimpl]
impl EscrowVestingContract {
    /// Initialize the escrow/vesting contract.
    /// This transfers the amount of tokens from the sender to the contract.
    pub fn initialize(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        unlock_time: u64,
    ) {
        // Prevent double initialization
        assert!(
            !env.storage().instance().has(&DataKey::State),
            "contract already initialized"
        );

        sender.require_auth();

        // Store contract state
        let state = EscrowState {
            sender: sender.clone(),
            recipient,
            token: token.clone(),
            amount,
            unlock_time,
            claimed: false,
        };
        env.storage().instance().set(&DataKey::State, &state);

        // Transfer funds from sender to contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);
    }

    /// Claim the vested/escrowed tokens.
    /// Can only be called by the recipient after the unlock time has passed.
    pub fn claim(env: Env) {
        let mut state: EscrowState = env
            .storage()
            .instance()
            .get(&DataKey::State)
            .expect("contract not initialized");

        assert!(!state.claimed, "tokens already claimed");

        // CRITICAL CHECK: Ensure ledger timestamp is >= unlock_time
        let now = env.ledger().timestamp();
        assert!(
            now >= state.unlock_time,
            "tokens are still locked: current time {} < unlock time {}",
            now,
            state.unlock_time
        );

        // Authorize the claim as the recipient
        state.recipient.require_auth();

        // Mark as claimed
        state.claimed = true;
        env.storage().instance().set(&DataKey::State, &state);

        // Transfer funds to recipient
        let token_client = token::Client::new(&env, &state.token);
        token_client.transfer(
            &env.current_contract_address(),
            &state.recipient,
            &state.amount,
        );
    }

    /// Fetch the current escrow/vesting state.
    pub fn get_state(env: Env) -> EscrowState {
        env.storage()
            .instance()
            .get(&DataKey::State)
            .expect("contract not initialized")
    }
}
`,
      },
      {
        name: "test.rs",
        type: "file",
        language: "rust",
        content: `#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_escrow_vesting() {
    let env = Env::default();
    env.mock_all_auths();

    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Register a mock token contract
    let token_id = env.register_stellar_asset_contract_v2(token_admin).address();
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Mint tokens to sender
    let amount = 1000i128;
    token_admin_client.mint(&sender, &amount);
    assert_eq!(token_client.balance(&sender), amount);

    // Register our EscrowVestingContract
    let contract_id = env.register_contract(None, EscrowVestingContract);
    let client = EscrowVestingContractClient::new(&env, &contract_id);

    // Set lock parameters
    let unlock_time = 1000u64;
    env.ledger().with_mut(|li| li.timestamp = 500);

    // Initialize escrow
    client.initialize(&sender, &recipient, &token_id, &amount, &unlock_time);

    // Verify contract holds the tokens
    assert_eq!(token_client.balance(&sender), 0);
    assert_eq!(token_client.balance(&contract_id), amount);

    // Try to claim before unlock time (should panic/fail)
    env.ledger().with_mut(|li| li.timestamp = 999);
    let result = std::panic::catch_unwind(|| {
        client.claim();
    });
    assert!(result.is_err());

    // Advance ledger timestamp beyond unlock_time and claim
    env.ledger().with_mut(|li| li.timestamp = 1000);
    client.claim();

    // Verify recipient received tokens and state is updated
    assert_eq!(token_client.balance(&recipient), amount);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert!(client.get_state().claimed);
}
`,
      },
      {
        name: "Cargo.toml",
        type: "file",
        language: "toml",
        content: `[package]
name = "timelocked-escrow"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
`,
      },
    ],
  },
  {
    name: "assets",
    type: "folder",
    children: [
      {
        name: "logo.svg",
        type: "file",
        content: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" stroke="white" stroke-width="3" fill="none" />
  <path d="M30 50 L50 30 L70 50 L50 70 Z" fill="white" />
</svg>`,
      },
      {
        name: "banner.png",
        type: "file",
        content: "base64_encoded_placeholder_data",
      },
      {
        name: "icon.webp",
        type: "file",
        content: "base64_encoded_placeholder_data",
      },
    ],
  },
];

export function findFile(nodes: FileNode[], path: string[]): FileNode | null {
  for (const node of nodes) {
    if (node.name === path[0]) {
      if (path.length === 1) return node;
      if (node.children) return findFile(node.children, path.slice(1));
    }
  }
  return null;
}
