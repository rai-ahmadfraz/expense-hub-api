import { Controller, Param, Req } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';    
import { UserService } from './users.service';
import type { Request } from 'express';
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {

    constructor(private userService:UserService){}
    
    @Get('profile')
    getProfile() {
        return { message: 'This is the user profile' };
    }

    @Get('search/:term')
    searchUsers(@Req() req: Request, @Param('term') term:string){

        return this.userService.searchUsers(req.user.id,term);

    }
}
