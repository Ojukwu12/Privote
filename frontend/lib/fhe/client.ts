// Zama FHE SDK Client - Production Implementation
// Handles encryption and decryption using Fully Homomorphic Encryption
// All operations use real FHE via the Zama Relayer SDK

/**
 * Encrypt a vote using Fully Homomorphic Encryption
 * Uses the Zama Relayer SDK to create encrypted votes that can be tallied while encrypted
 *
 * @param publicKey - Not used (SDK handles key management server-side)
 * @param choice - 'yes' or 'no' vote choice
 * @param options - Contract address and user address
 * @returns Encrypted handles and input proof for contract submission
 * @throws Error if FHE SDK is not available or encryption fails
 */
export async function encryptWithPublicKey(
  publicKey: string | undefined,
  choice: 'yes' | 'no' | string,
  options: { contractAddress?: string; userAddress?: string } = {}
) {
  try {
    // Validate required configuration
    if (!options.contractAddress) {
      throw new Error('Contract address required for encryption');
    }

    // Import Zama Relayer SDK
    let sdk: any;
    try {
      sdk = await import('@zama-fhe/relayer-sdk');
    } catch (e1) {
      try {
        sdk = await import('@zama-fhe/relayer-sdk/browser');
      } catch (e2) {
        throw new Error('Zama FHE Relayer SDK not available. Please install @zama-fhe/relayer-sdk.');
      }
    }

    // Get SDK factory function
    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;
    if (!createFn) {
      throw new Error('Relayer SDK does not expose createInstance factory function');
    }

    // Collect configuration from environment variables
    const relayerUrl = process.env.NEXT_PUBLIC_FHE_RELAYER_URL;
    const network = process.env.NEXT_PUBLIC_FHE_NETWORK_RPC_URL;
    const aclContractAddress = process.env.NEXT_PUBLIC_FHE_ACL_CONTRACT_ADDRESS;
    const kmsContractAddress = process.env.NEXT_PUBLIC_FHE_KMS_CONTRACT_ADDRESS;
    const inputVerifierContractAddress = process.env.NEXT_PUBLIC_FHE_INPUT_VERIFIER_CONTRACT_ADDRESS;
    const verifyingContractAddressDecryption = process.env.NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_DECRYPTION;
    const verifyingContractAddressInputVerification = process.env.NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_INPUT_VERIFICATION;
    const chainId = process.env.NEXT_PUBLIC_FHE_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_FHE_CHAIN_ID) : undefined;
    const gatewayChainId = process.env.NEXT_PUBLIC_FHE_GATEWAY_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_FHE_GATEWAY_CHAIN_ID) : undefined;

    // Validate critical configuration
    if (!relayerUrl) {
      throw new Error('NEXT_PUBLIC_FHE_RELAYER_URL not configured');
    }
    if (!aclContractAddress) {
      throw new Error('NEXT_PUBLIC_FHE_ACL_CONTRACT_ADDRESS not configured');
    }
    if (!chainId) {
      throw new Error('NEXT_PUBLIC_FHE_CHAIN_ID not configured');
    }

    // Create SDK instance
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

    if (!instance) {
      throw new Error('Failed to initialize FHE SDK instance');
    }

    // Create encrypted input for the vote contract
    const inputBuffer = instance.createEncryptedInput?.(options.contractAddress, options.userAddress);
    if (!inputBuffer) {
      throw new Error('SDK did not provide encrypted input buffer. SDK may be incorrectly configured.');
    }

    // Encrypt the vote choice as a boolean
    const voteValue = choice === 'yes';
    
    if (typeof inputBuffer.addBool === 'function') {
      // Preferred: use boolean type directly
      inputBuffer.addBool(voteValue);
    } else if (typeof inputBuffer.add64 === 'function') {
      // Fallback: use uint64 (1 for yes, 0 for no)
      inputBuffer.add64(voteValue ? BigInt(1) : BigInt(0));
    } else {
      throw new Error('SDK inputBuffer does not support addBool or add64 methods');
    }

    // Encrypt the input
    const encrypted = await inputBuffer.encrypt();
    
    if (!encrypted || !encrypted.handles) {
      throw new Error('Encryption failed: no handles returned from SDK');
    }

    if (!Array.isArray(encrypted.handles) || encrypted.handles.length === 0) {
      throw new Error('Encryption returned invalid handles format');
    }

    return {
      handles: encrypted.handles,
      inputProof: encrypted.inputProof || ''
    };

  } catch (err) {
    // Re-throw with clear production error message
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Homomorphic encryption failed: ${errorMessage}`);
  }
}

/**
 * Decrypt vote results using user's private key
 * Allows users to decrypt and verify the tally themselves
 *
 * @param privateKey - User's private key (RSA or EC format)
 * @param handles - Encrypted result handles from the contract
 * @param options - Optional contract addresses
 * @returns Decrypted values mapped by handle
 * @throws Error if decryption fails or SDK is unavailable
 */
export async function userDecryptWithPrivateKey(
  privateKey: string,
  handles: string[],
  options: { contractAddresses?: string[] } = {}
) {
  try {
    if (!privateKey) {
      throw new Error('Private key is required for decryption');
    }

    if (!handles || handles.length === 0) {
      throw new Error('No encrypted handles provided for decryption');
    }

    // Import Zama Relayer SDK
    let sdk: any;
    try {
      sdk = await import('@zama-fhe/relayer-sdk');
    } catch (e1) {
      try {
        sdk = await import('@zama-fhe/relayer-sdk/browser');
      } catch (e2) {
        throw new Error('Zama FHE Relayer SDK not available for decryption');
      }
    }

    // Get SDK factory function
    const createFn = sdk.createInstance || sdk.createClient || sdk.createFheInstance || sdk.default?.createInstance;
    if (!createFn) {
      throw new Error('Relayer SDK does not expose createInstance function');
    }

    // Create SDK instance for decryption
    const relayerUrl = process.env.NEXT_PUBLIC_FHE_RELAYER_URL;
    const network = process.env.NEXT_PUBLIC_FHE_NETWORK_RPC_URL;

    if (!relayerUrl) {
      throw new Error('NEXT_PUBLIC_FHE_RELAYER_URL not configured for decryption');
    }

    const instance = await createFn({
      relayerUrl,
      network
    });

    if (!instance) {
      throw new Error('Failed to create SDK instance for decryption');
    }

    // Attempt user-side decryption
    if (typeof instance.userDecrypt === 'function') {
      const handleContractPairs = handles.map(h => ({
        handle: h,
        contractAddress: options.contractAddresses?.[0]
      }));

      const result = await instance.userDecrypt(handleContractPairs, privateKey);
      return result;
    } else {
      throw new Error('SDK does not support userDecrypt function. Decryption not available.');
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Decryption failed: ${errorMessage}`);
  }
}

export default { encryptWithPublicKey, userDecryptWithPrivateKey };
