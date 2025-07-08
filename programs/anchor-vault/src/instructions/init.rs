use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::state::VaultState;

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
impl<'info> Init<'info> {
    pub fn init(&mut self, bumps: &InitBumps) -> Result<()> {

        // get rent exempt lamports needed to initialize vault
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
