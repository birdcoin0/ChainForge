import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 1. Extract headers
    const signatureHeader = request.headers['x-chainforge-signature'] as string;
    const timestampHeader = request.headers['x-chainforge-timestamp'] as string;

    if (!signatureHeader || !timestampHeader) {
      throw new UnauthorizedException('Missing signature or timestamp headers');
    }

    // 2. Replay attack prevention: Ensure the timestamp is within a 5-minute window (300 seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestampHeader, 10);

    if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > 300) {
      throw new UnauthorizedException('Request timestamp expired or invalid');
    }

    // 3. Get signature secret
    const secret = process.env.WEBHOOK_SIGNING_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Webhook signing secret is not configured');
    }

    // 4. Retrieve raw body (NestJS raw body is required for verification)
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Raw request body is missing for signature verification');
    }

    // Extract signature hash from format: sha256=<hex_signature>
    const expectedSignature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    // 5. Compute expected HMAC
    const hmac = crypto.createHmac('sha256', secret);
   hmac.update(timestampHeader + '.' + rawBody.toString());
    const computedSignature = hmac.digest('hex');

    // 6. Prevent timing attacks using timingSafeEqual
    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const computedBuffer = Buffer.from(computedSignature, 'hex');

      if (
        expectedBuffer.length !== computedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, computedBuffer)
      ) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid signature format');
    }

    return true;
  }
}
