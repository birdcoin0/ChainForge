import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { WebhookGuard } from './webhook.guard';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  @Post()
  @UseGuards(WebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Received verified webhook payload successfully');

    // Here we will handle the incoming task results
    // Example: Update the claim status in the database based on the AI service task output
    const { taskId, status, result } = payload;
    
    this.logger.log(`Task ${taskId} completed with status: ${status}`);

    // TODO: Integrate with your Claims/Campaigns service to update state
    
    return { received: true };
  }
}
 
