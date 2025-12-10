// Lightweight FHE client wrapper for frontend encryption.
// Tries to use a real FHE SDK if available; otherwise falls back to a mock for UX/testing.

/**
 * Encrypt a vote value using the provided public key / relayer instance.
 * Returns { handles: string[], inputProof: string } where handles should be
 * sent to the backend as a JSON-stringified array in the `encryptedVote` field.
 */
export async function encryptWithPublicKey(publicKey: string | undefined, choice: 'yes' | 'no' | string, options: { contractAddress?: string, userAddress?: string } = {}) {
  // Attempt to initialize the Zama relayer SDK in-browser and create a real
  // encrypted input. If the SDK or configuration is missing we fall back to
  // a clearly-labelled mock to keep the UI usable during development.
  try {
    // Try common package entrypoints (browser or root)
    let sdk: any;
    try {
      sdk = await import('@zama-fhe/relayer-sdk');
    } catch (e1) {
      try {
        sdk = await import('@zama-fhe/relayer-sdk/browser');
      } catch (e2) {
        throw new Error('Relayer SDK not available in browser');
      }
    }

    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;
    if (!createFn) throw new Error('Relayer SDK does not expose createInstance');

    // Collect configuration from NEXT_PUBLIC_ env vars
    const relayerUrl = process.env.NEXT_PUBLIC_FHE_RELAYER_URL;
    const network = process.env.NEXT_PUBLIC_FHE_NETWORK_RPC_URL;
    const aclContractAddress = process.env.NEXT_PUBLIC_FHE_ACL_CONTRACT_ADDRESS;
    const kmsContractAddress = process.env.NEXT_PUBLIC_FHE_KMS_CONTRACT_ADDRESS;
    const inputVerifierContractAddress = process.env.NEXT_PUBLIC_FHE_INPUT_VERIFIER_CONTRACT_ADDRESS;
    const verifyingContractAddressDecryption = process.env.NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_DECRYPTION;
    const verifyingContractAddressInputVerification = process.env.NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_INPUT_VERIFICATION;
    const chainId = process.env.NEXT_PUBLIC_FHE_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_FHE_CHAIN_ID) : undefined;
    const gatewayChainId = process.env.NEXT_PUBLIC_FHE_GATEWAY_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_FHE_GATEWAY_CHAIN_ID) : undefined;

    const instance = await createFn({
      relayerUrl,
      network,
      aclContractAddress,
      kmsContractAddress,
      inputVerifierContractAddress,
      verifyingContractAddressDecryption,
      verifyingContractAddressInputVerification,
      chainId,
      gatewayChainId
    });

    // Create the input buffer for the vote contract and add the boolean value
    const inputBuffer = instance.createEncryptedInput?.(options.contractAddress, options.userAddress);
    if (!inputBuffer) throw new Error('SDK createEncryptedInput not available');

    // Use boolean input (assume contract expects a bool for yes/no)
    if (typeof inputBuffer.addBool === 'function') {
      inputBuffer.addBool(choice === 'yes');
    } else if (typeof inputBuffer.add64 === 'function') {
      // Fallback: map yes->1, no->0
      inputBuffer.add64(choice === 'yes' ? BigInt(1) : BigInt(0));
    } else {
      throw new Error('SDK inputBuffer does not support addBool/add64');
    }

    const encrypted = await inputBuffer.encrypt();
    return { handles: encrypted.handles || [], inputProof: encrypted.inputProof || '' };
  } catch (err) {
    console.warn('FHE browser SDK unavailable or failed; returning mock handles. Error:', err);
  }

  // Mock fallback: return a clearly-labelled fake handle and proof
  const ts = Date.now();
  return { handles: [`MOCK_HANDLE:${choice}:${ts}`], inputProof: `MOCK_PROOF:${choice}:${ts}` };
}

/**
 * Decrypt handles client-side using user's private key (via relayer SDK if available).
 * Returns an object mapping handle->value (mock or real depending on SDK availability).
 */
export async function userDecryptWithPrivateKey(privateKey: string, handles: string[], options: { contractAddresses?: string[] } = {}) {
  try {
    let sdk: any;
    try {
      sdk = await import('@zama-fhe/relayer-sdk');
    } catch (e1) {
      try {
        sdk = await import('@zama-fhe/relayer-sdk/browser');
      } catch (e2) {
        throw new Error('Relayer SDK not available in browser');
      }
    }

    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;
    if (!createFn) throw new Error('Relayer SDK does not expose createInstance');

    const relayerUrl = process.env.NEXT_PUBLIC_FHE_RELAYER_URL;
    const network = process.env.NEXT_PUBLIC_FHE_NETWORK_RPC_URL;
    const instance = await createFn({ relayerUrl, network });

    if (typeof instance.userDecrypt === 'function') {
      const handleContractPairs = handles.map(h => ({ handle: h, contractAddress: options.contractAddresses?.[0] }));
      const result = await instance.userDecrypt(handleContractPairs, privateKey);
      return result;
    }
  } catch (err) {
    console.warn('User decrypt via SDK failed, falling back to mock:', err);
  }

  // Mock fallback: return deterministic decode for our mock format
  const decoded: Record<string, any> = {};
  for (const h of handles) {
    if (typeof h === 'string' && h.startsWith('MOCK_HANDLE:')) {
      const parts = h.split(':');
      const choice = parts[1];
      decoded[h] = choice === 'yes' ? 1n : 0n;
    } else {
      decoded[h] = BigInt(0);
    }
  }
  return decoded;
}

export default { encryptWithPublicKey, userDecryptWithPrivateKey };
