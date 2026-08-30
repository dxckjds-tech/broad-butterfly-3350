import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('status')
  status() {
    return {
      authenticated: false,
      provider: 'none',
      note: 'Auth is reserved for a later phase.',
    };
  }
}
