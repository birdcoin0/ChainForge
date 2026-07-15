# Webhook Signing

All webhooks are signed using HMAC SHA256.
The secret key is stored in the environment variable `WEBHOOK_SIGNING_SECRET`.

To verify the signature, calculate the HMAC SHA256 of the raw request body using your secret key.
