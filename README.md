# Anchor Vault

This program implements a simple Vault contract that allows users to deposit, withdraw, and manage SOL in a secure vault account. Users can initialize a vault, deposit SOL into it, withdraw SOL from it, and close the vault when they want to withdraw all the amount.

---

## Architecture

The Vault state account consists of:

```rust
#[account]
pub struct VaultState {
    pub vault_bump: u8,    // bump of the vault PDA
    pub state_bump: u8,    // bump of the state PDA
}
```

The VaultState account stores:

- `vault_bump`: The PDA bump seed for the vault account
- `state_bump`: The PDA bump seed for the state account

The VaultState account is derived as a PDA from "state" and the user's public key. The Vault account (a SystemAccount) is derived from "vault" and the VaultState's public key.

---

### Init Instruction

The user initializes a vault with the following context:

```rust
#[derive(Accounts)]
pub struct Init<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init, 
        payer = user, 
        space = VaultState::INIT_SPACE, 
        seeds = [b"state", user.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

Accounts:

- `user`: Signer creating the vault (mutable)
- `vault_state`: State account that stores vault information (PDA derived from "state" and user key)
- `vault`: System account that holds the SOL (PDA derived from "vault" and vault_state key)
- `system_program`: System program

### Implementation

```rust
impl<'info> Init<'info> {
    pub fn init(&mut self, bumps: &InitBumps) -> Result<()> {
        let rent_exempt_lamports = Rent::get()?.minimum_balance(self.vault.data_len());

        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, rent_exempt_lamports)?;

        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;

        Ok(())
    }
}
```

`init` initializes the vault state account with the bump seeds and transfers the minimum rent-exempt lamports to the vault account to make it rent-exempt.

---

### Deposit Instruction

The user deposits SOL into the vault with the following context:

```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

Accounts:

- `user`: Signer depositing SOL (mutable)
- `vault_state`: State account for the vault
- `vault`: Vault account receiving the SOL (mutable)
- `system_program`: System program

### Implementation

```rust
impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)
    }
}
```

`deposit` transfers SOL from the user's account to the vault account.

---

### Withdraw Instruction

The user withdraws SOL from the vault with the following context:

```rust
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

Accounts:

- `user`: Signer withdrawing SOL (mutable)
- `vault_state`: State account for the vault
- `vault`: Vault account sending the SOL (mutable)
- `system_program`: System program

### Implementation

```rust
impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        let rent_exempt_lamports = Rent::get()?.minimum_balance(self.vault.data_len());
        let amount_remaining: i64 = self.vault.lamports() as i64 - amount as i64;
        require!(amount_remaining >= rent_exempt_lamports as i64, ErrorCode::InsufficientFunds);

        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };
        let vault_state_key = self.vault_state.key();
        let seeds = &[
            b"vault", 
            vault_state_key.as_ref(), 
            &[self.vault_state.vault_bump]
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        transfer(cpi_ctx, amount)
    }
}
```

`withdraw` transfers SOL from the vault to the user's account. It checks that enough lamports remain in the vault to keep it rent-exempt. Since the vault is a PDA, signer seeds are required for the CPI.

---

### Close Instruction

The user closes the vault and withdraws all remaining SOL with the following context:

```rust
#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user,
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

Accounts:

- `user`: Signer closing the vault (mutable)
- `vault_state`: State account being closed (rent returned to user)
- `vault`: Vault account from which SOL is transferred
- `system_program`: System program

### Implementation

```rust
impl<'info> Close<'info> {
    pub fn withdraw_and_close(&mut self) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };
        let vault_state_key = self.vault_state.key();
        let seeds = &[
            b"vault", 
            vault_state_key.as_ref(), 
            &[self.vault_state.vault_bump]
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        let amount = self.vault.lamports();
        transfer(cpi_ctx, amount)
    }
}
```

`withdraw_and_close` transfers all remaining SOL from the vault to the user and closes the vault_state account, returning rent to the user. Since the vault is a PDA, signer seeds are required for the CPI.

---

### Program Instructions

```rust
#[program]
pub mod anchor_vault {
    use super::*;

    pub fn init(ctx: Context<Init>) -> Result<()> {
        ctx.accounts.init(&ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.withdraw_and_close()
    }
}
```

The `init` instruction initializes the vault state account and vault account.

The `deposit` instruction transfers SOL from the user to the vault.

The `withdraw` instruction transfers SOL from the vault to the user.

The `close` instruction withdraws all remaining SOL from the vault and closes the vault state account.

