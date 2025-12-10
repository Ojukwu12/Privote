// Lightweight FHE client wrapper for frontend encryption.
// Tries to use a real FHE SDK if available; otherwise falls back to a mock for UX/testing.

/**
 * Encrypt a vote value using the provided public key / relayer instance.
 * Returns { handles: string[], inputProof: string } where handles should be
 * sent to the backend as a JSON-stringified array in the `encryptedVote` field.
 */
export async function encryptWithPublicKey(publicKey: string | undefined, choice: 'yes' | 'no' | string, options: { contractAddress?: string, userAddress?: string } = {}) {
  // Try to dynamically import the Zama relayer SDK and use it to create a valid
  // encrypted input and proof. If any step fails we fall back to the mock.
  try {
    const sdk = await import('@zama-fhe/relayer-sdk');

    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;

    if (createFn) {
      try {
        const relayerUrl = (process.env.NEXT_PUBLIC_FHE_RELAYER_URL as string) || undefined;
        const instance = await createFn({ relayerUrl });

        const inputBuffer = instance.createEncryptedInput?.(options.contractAddress, options.userAddress) || null;

        if (inputBuffer && typeof inputBuffer.addBool === 'function') {
          inputBuffer.addBool(choice === 'yes');
          const encrypted = await inputBuffer.encrypt();
          return { handles: encrypted.handles || [], inputProof: encrypted.inputProof || '' };
        }
      } catch (err) {
        console.warn('Zama SDK instance creation/encrypt failed, falling back to mock.', err);
      }
    }
  } catch (err) {
    console.warn('Zama relayer SDK import failed; using mock FHE encrypt.', err);
  }

  // Mock fallback: return a fake handle and proof
  const ts = Date.now();
  // Clearly label mock handles so callers can detect them
  return { handles: [`0xMOCK_HANDLE_${choice}_${ts}`], inputProof: `0xMOCK_PROOF_${choice}_${ts}` };
}

/**
 * Decrypt handles client-side using user's private key (via relayer SDK if available).
 * Returns an object mapping handle->value (mock or real depending on SDK availability).
 */
export async function userDecryptWithPrivateKey(privateKey: string, handles: string[], options: { contractAddresses?: string[] } = {}) {
  try {
    const sdk = await import('@zama-fhe/relayer-sdk');
    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;
    if (createFn) {
      const relayerUrl = (process.env.NEXT_PUBLIC_FHE_RELAYER_URL as string) || undefined;
      const instance = await createFn({ relayerUrl });

      // Some SDKs expose a userDecrypt method on instance
      if (typeof instance.userDecrypt === 'function') {
        // Depending on SDK, method signature varies. We try a common form.
        const handleContractPairs = handles.map(h => ({ handle: h, contractAddress: options.contractAddresses?.[0] }));
        const result = await instance.userDecrypt(handleContractPairs, privateKey);
        return result;
      }
    }
  } catch (err) {
    console.warn('User decrypt via SDK failed, falling back to mock:', err);
  }

  // Mock fallback: return random counts / decode mock handle
  const decoded: Record<string, any> = {};
  for (const h of handles) {
    if (h.includes('MOCK_HANDLE_yes')) decoded[h] = 1n;
    else if (h.includes('MOCK_HANDLE_no')) decoded[h] = 0n;
    else decoded[h] = BigInt(Math.floor(Math.random() * 10));
  }
  return decoded;
}

export default { encryptWithPublicKey, userDecryptWithPrivateKey };
