import { Controller, Get, Param, Req } from '@nestjs/common';
import { FriendService } from './friend.service';
import type { Request } from 'express';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendController {
  constructor(private friendService: FriendService) {}

  @Get()
  friends(@Req() req: Request){
      return this.friendService.getFriendsList(req.user.id);
  }

  @Get('search/:term')
  serachFriend(@Req() req: Request, @Param('term') term:string){
      // this.friendService.serachFriend();
  }
  addFriend(@Req() req: Request, @Param('term') term:string){
    
  }
}
