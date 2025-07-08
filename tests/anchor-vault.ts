import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault";
import { expect } from "chai";

describe("anchor-vault", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorVault as Program<AnchorVault>;

  const vaultState = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("state"), provider.publicKey.toBytes()], program.programId)[0];
  const vault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("vault"), vaultState.toBytes()], program.programId)[0];

  it("Vault initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.init()
    .accountsPartial({
      user: provider.wallet.publicKey,
      vaultState,
      vault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
    console.log("\nYour transaction signature", tx);
    console.log("Your vault info", (await provider.connection.getAccountInfo(vault)));
  });

  it("Deposit 10 SOL into Vault!", async () => {
    // Add your test here.
    const tx = await program.methods.deposit(new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL))
    .accountsPartial({
      user: provider.wallet.publicKey,
      vaultState,
      vault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
    console.log("\nYour transaction signature", tx);
    console.log("Your vault info", (await provider.connection.getAccountInfo(vault)));
  });

  it("Attempt to withdraw 15 SOL from Vault", async () => {
    // Add your test here.
    try {
      const tx = await program.methods.withdraw(new anchor.BN(15 * anchor.web3.LAMPORTS_PER_SOL))
      .accountsPartial({
        user: provider.wallet.publicKey,
        vaultState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      console.log("\nYour transaction signature", tx);
      console.log("Your vault info", (await provider.connection.getAccountInfo(vault)));
      // If we reach here, the transaction succeeded unexpectedly
      expect.fail("Expected transaction to fail due to insufficient funds");
    } catch (error) {
      console.log("Expected error caught:", error.message);
      expect(error.message).to.contain("InsufficientFunds");
    }
  });

  it("Withdraw 5 SOL from Vault!", async () => {
    // Add your test here.
    const tx = await program.methods.withdraw(new anchor.BN(5 * anchor.web3.LAMPORTS_PER_SOL))
    .accountsPartial({
      user: provider.wallet.publicKey,
      vaultState,
      vault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
    console.log("\nYour transaction signature", tx);
    console.log("Your vault info", (await provider.connection.getAccountInfo(vault)));
  });

  it("Attempt to withdraw more than rent exempt from Vault", async () => {
    // Add your test here.
    try {
      const tx = await program.methods.withdraw(new anchor.BN(15 * anchor.web3.LAMPORTS_PER_SOL + 1))
      .accountsPartial({
        user: provider.wallet.publicKey,
        vaultState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      console.log("\nYour transaction signature", tx);
      console.log("Your vault info", (await provider.connection.getAccountInfo(vault)));
      // If we reach here, the transaction succeeded unexpectedly
      expect.fail("Expected transaction to fail due to insufficient funds");
    } catch (error) {
      console.log("Expected error caught:", error.message);
      expect(error.message).to.contain("InsufficientFunds");
    }
  });

  it("Close Vault!", async () => {
    // Add your test here.
    const tx = await program.methods.close()
    .accountsPartial({
      user: provider.wallet.publicKey,
      vaultState,
      vault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  });

});
