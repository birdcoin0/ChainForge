# Soroban Testnet Deployment Runbook

This runbook documents a repeatable procedure for building, deploying, initializing, and verifying the `aid_escrow` Soroban contract on Stellar Testnet.

## 1. Purpose

Use this runbook to deploy the contract consistently, verify success, and perform a minimal post-deploy health check.

## 2. Prerequisites

- Linux / macOS shell environment
- Rust toolchain installed
- `wasm32-unknown-unknown` target installed
- `soroban-cli` installed
- A funded Testnet account secret key

### Install required tools

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```

## 3. Environment setup

From `app/onchain` create a `.env` file using `.env.example` as a template.

```bash
cd /workspaces/Soter/app/onchain
cp .env.example .env
```

Edit `.env` and set the following values:

```bash
NETWORK=testnet
SECRET_KEY=SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PUBLIC_KEY=GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CONTRACT_NAME=aid_escrow
TESTNET_RPC_URL=https://soroban-testnet.stellar.org:443
```

> If you use a different RPC endpoint, set `TESTNET_RPC_URL` accordingly.

## 4. Build steps

Build the contract to WebAssembly from the `app/onchain` directory.

```bash
cd /workspaces/Soter/app/onchain
cargo build --release --target wasm32-unknown-unknown -p aid_escrow
```

Confirm the build output exists:

```bash
ls target/wasm32-unknown-unknown/release/aid_escrow.wasm
```

Expected output:

- `target/wasm32-unknown-unknown/release/aid_escrow.wasm`

## 5. Deploy steps

Use the existing deploy script to publish the contract to Testnet.

```bash
cd /workspaces/Soter/app/onchain
./scripts/deploy.sh --network testnet
```

If the deploy succeeds, note the returned contract ID.

Example expected output:

```text
✅ Deployment successful!
📋 Contract ID: ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
```

If the script updates `.env`, it will also write `CONTRACT_ID=<id>` there.

### Manual deploy alternative

If you want to deploy directly without the wrapper script:

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/aid_escrow.wasm \
  --source "$SECRET_KEY" \
  --network testnet \
  --rpc-url "$TESTNET_RPC_URL"
```

## 6. Initialization steps

After deploy, initialize the contract by setting the admin address.

```bash
cd /workspaces/Soter/app/onchain
./scripts/initialize.sh --contract "$CONTRACT_ID" --admin "$PUBLIC_KEY" --network testnet
```

Expected output should include a transaction result and a transaction hash.

## 7. Verification steps

### 7.1 Check admin

Verify the contract was initialized and the admin is set:

```bash
cd /workspaces/Soter/app/onchain
./scripts/testnet-invoke.sh get-admin --contract-id "$CONTRACT_ID" --source "$SECRET_KEY"
```

Expected output:

- the admin public key should match the value passed to `--admin`
- a transaction hash should be shown

### 7.2 Verify contract state with a query

The existing helper script can be used to verify view methods and contract state. The easiest read-only verification is the admin query via `get-admin`.

```bash
./scripts/testnet-invoke.sh get-admin --contract-id "$CONTRACT_ID" --source "$SECRET_KEY"
```

If you want a package-specific query later, use `./scripts/query.sh` with one of the supported actions:

```bash
./scripts/query.sh --contract "$CONTRACT_ID" --action get_package --id 1 --network testnet
```

### 7.3 Optional package sanity check

Use the helper script to create and query a package if you want a functional end-to-end test:

```bash
./scripts/testnet-invoke.sh create-package \
  --operator "$PUBLIC_KEY" \
  --id 1 \
  --recipient "GRECIPIENT..." \
  --amount 10000000 \
  --token "CTOKEN..."

./scripts/testnet-invoke.sh get-package --id 1 --contract-id "$CONTRACT_ID"
```

## 8. Minimal post-deploy health check

Run these checks immediately after initialization:

1. Confirm contract ID is present in `.env` or from deploy output.
2. Confirm RPC endpoint responds:

```bash
curl -I "$TESTNET_RPC_URL"
```

3. Confirm `get-admin` returns the expected admin:

```bash
./scripts/testnet-invoke.sh get-admin --contract-id "$CONTRACT_ID" --source "$SECRET_KEY"
```

Expected responses:

- HTTP 200 / reachable RPC endpoint
- `Transaction hash:` present in command output
- returned admin address equals the expected admin public key

## 9. Troubleshooting common Soroban RPC issues

### 9.1 RPC endpoint unreachable or timeout

Symptoms:
- `connection refused`
- `Failed to connect`
- `timeout`

Actions:
- Verify the RPC URL is correct.
- Check network connectivity.
- Try a different public RPC endpoint.
- Confirm the endpoint is not blocked by local firewall or proxy.

Example:

```bash
curl -v "$TESTNET_RPC_URL"
```

### 9.2 `soroban` CLI returns `error: invalid request` or `method not found`

Cause:
- wrong RPC path
- misconfigured endpoint

Fix:
- Use `https://soroban-testnet.stellar.org:443` for public Testnet.
- For standalone local RPC use `http://localhost:8000/soroban/rpc`.

### 9.3 RPC returns stale or failed ledger data

Symptoms:
- `timeout waiting for ledger` or ledger sync errors
- unexpected `transaction failed` responses

Fix:
- Retry the request after a short delay.
- Confirm the endpoint is healthy from the provider.
- If using a local node, ensure it is fully synced.

### 9.4 Transaction fails unexpectedly after deploy

Symptoms:
- `contract deploy` returns error or no contract ID
- `soroban contract invoke` returns failure

Common causes:
- deployer account is not funded with enough Testnet XLM
- wrong `SECRET_KEY` or malformed key
- contract artifact not built or wrong WASM path
- contract ID missing or incorrectly passed

Fix:
- Fund the account with Testnet friendbot if needed.
- Confirm `SECRET_KEY` is valid and corresponds to a funded account.
- Rebuild the contract and verify `target/wasm32-unknown-unknown/release/aid_escrow.wasm` exists.
- Re-run deploy with `./scripts/deploy.sh --network testnet`.

### 9.5 Public RPC rate limiting or service disruption

Symptoms:
- `HTTP 429`
- `service unavailable`
- intermittent acknowledgements

Fix:
- Wait a few minutes and retry.
- Use a dedicated or alternative RPC endpoint if available.
- If the public endpoint is down, switch to a different provider or local Soroban node.

### 9.6 `Contract ID` not extracted or `.env` not updated

Symptoms:
- contract deploy prints the ID but script does not save it
- `.env` still missing `CONTRACT_ID`

Fix:
- Copy the contract ID from deploy output manually.
- Add `CONTRACT_ID=<id>` to `.env`.
- Re-run initialization with the saved ID.

## 10. Notes

- The `app/onchain/scripts/deploy.sh` wrapper uses `SECRET_KEY` or `DEPLOYER_SECRET_KEY` from `.env`.
- The contract is built from the `aid_escrow` crate.
- Always keep secret keys out of source control.

---

If the public Soroban Testnet RPC is failing repeatedly, use a secondary provider or local standalone node for consistent deployment.
