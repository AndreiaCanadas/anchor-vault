use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::VaultState;
use crate::errors::ErrorCode;

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

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {

        // Check if the user has enough funds in the vault to withdraw and to vault be left with rent exempt
        let rent_exempt_lamports = Rent::get()?.minimum_balance(self.vault.data_len());
        let amount_remaining:i64 = self.vault.lamports() as i64 - amount as i64;
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