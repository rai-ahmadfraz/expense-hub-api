import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FriendService {
  constructor(private prisma: PrismaService) {}

  async getFriendsList(loginUserId: number) {
    const relations = await this.prisma.friend.findMany({
      where: {
        OR: [
          { userId: loginUserId, status: 'accepted' },
          { friendId: loginUserId, status: 'accepted' },
        ],
      },
      include: {
        user: true,
        friend: true,
      },
    });

    // Extract only the other friend (not yourself)
    const friends = relations.map(f =>
      f.userId === loginUserId ? f.friend : f.user,
    );

    // Remove duplicates if any
    const uniqueFriends = friends
        .filter((friend): friend is NonNullable<typeof friend> => friend != null)
        .filter((friend, index, arr) => 
            arr.findIndex(f => f.id === friend.id) === index
        );

    return uniqueFriends;
  }

  async addNewFriend(loginUserId: number, friendId: number) {
    if (loginUserId === friendId) {
      throw new BadRequestException('Cannot add yourself');
    }

    const friendList = await this.getFriendsList(loginUserId);
    const friendIds = friendList.map(f => f.id);

    if (friendIds.includes(friendId)) {
      throw new BadRequestException('Already in your friend list');
    }

    return this.prisma.friend.create({
      data: {
        user: { connect: { id: loginUserId } },
        friend: { connect: { id: friendId } },
      },
    });
  }

  async searchFriend(term: string) {
    return this.prisma.friend.findMany({
      where: {
        OR: [
          { user: { name: { contains: term, mode: 'insensitive' } } },
          { friend: { name: { contains: term, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: true,
        friend: true,
      },
    });
  }
}
