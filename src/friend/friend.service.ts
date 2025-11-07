import { Injectable } from '@nestjs/common';
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

}
