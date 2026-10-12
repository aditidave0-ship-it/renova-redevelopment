// The original runner created pre-verification accounts and expected HTTP 201.
// Keep this entry point fail-closed so it cannot accidentally create production
// records or be treated as acceptance of the OTP-based account foundation.
throw new Error(
  "The pre-OTP acceptance runner is retired. Run the isolated database/security suite, then complete reviewed staging inbox and authenticated browser acceptance. This runner has made no API requests or database writes.",
);
