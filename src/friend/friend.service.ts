import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Friend } from 'src/entities/friend.entity';
import { Repository } from 'typeorm';

@Injectable()
export class FriendService {

    constructor(@InjectRepository(Friend) private friendRepository: Repository<Friend>){}


    async searchFriend(){
        // this.friendRespository.find({where:{}});

    }

    async getFriendsList(loginUserId: number) {
        const relations = await this.friendRepository.find({
            where: [
            { user: { id: loginUserId }, status: 'accepted' },
            { friend: { id: loginUserId }, status: 'accepted' },
            ],
            relations: ['user', 'friend'],
        });

        // Extract only the other friend (not yourself)
        const friends = relations.map(f => 
            f.user.id === loginUserId ? f.friend : f.user
        );

        // Remove duplicates if any
        const uniqueFriends = friends.filter(
            (friend, index, arr) => arr.findIndex(f => f.id === friend.id) === index
        );

        return uniqueFriends;
    }

    async addNewFriend(loginUserId:number,friendId:number){

        const friendList = await this.getFriendsList(loginUserId); 
        const friendIds = friendList.map((friend: any) => friend.id);
        
        if(friendId == loginUserId){
            throw new BadRequestException('Cannot add yourself');
        }
        else if(friendIds.includes(friendId)){
            throw new BadRequestException('Its already in your Friend list');
        }
        
        const friend = this.friendRepository.create({
            user:{id:loginUserId},
            friend:{id:friendId}
        });

        return await this.friendRepository.save(friend);
    }

}
