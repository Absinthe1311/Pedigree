import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FamilyStats } from "../query/query.service";
import { Collab } from './collab.entity';
import { FamilyTree } from '../families/families.entity'
import {User} from '../users/user.entity';
import {Repository, TreeChildren} from 'typeorm';
import { CreateCollabDto } from "./dto/create-collab.dto";

@Injectable()
export class CollabService {
    
    constructor(
        @InjectRepository(Collab)
        private readonly collabRepo: Repository<Collab>,

        @InjectRepository(FamilyTree)
        private readonly familyRepo: Repository<FamilyTree>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>
    ){}

    // 内部辅助
    private async verifyCreator(treeId: number, userId: number):
    Promise<FamilyTree>{
        const family = await this.familyRepo.findOne({
            where:{treeId}
        });

        if(!family) throw new NotFoundException('族谱不存在');
        if(family.creatorId !== userId) throw new ForbiddenException('仅族谱的创建者可以管理协作者');
        return family;
    }

    // 邀请协作者
    async invite(
        treeId: number,
        dto: CreateCollabDto,
        inviterId: number,
    ):Promise<Collab>{
        await this.verifyCreator(treeId, inviterId);

        // 验证被邀请者确实存在
        const invitee = await this.userRepo.findOne({
            where:{userId: dto.inviteeId},
        });
        if(!invitee){
            throw new NotFoundException(`用户ID ${dto.inviteeId}不存在`);
        }

        // 不能邀请自己
        if(dto.inviteeId === inviterId) {
            throw new BadRequestException('不能邀请自己作为协作者');
        }

        // 检查是否已经邀请过
        const existing = await this.collabRepo.findOne({
            where:{treeId, inviteeId: dto.inviteeId}
        });
        if(existing) {
            throw new ConflictException(`用户ID${dto.inviteeId}已经是该族谱的协作者`);
        }

        const collab = this.collabRepo.create({
            treeId,
            inviterId,
            inviteeId: dto.inviteeId,
        });

        return this.collabRepo.save(collab);
    }

    // 获取族谱的所有的协作者
    async findAll(treeId: number ,userId: number): Promise<any[]> {
        await this.verifyCreator(treeId, userId);

        const collabs = await this.collabRepo
        .createQueryBuilder('c')
        .leftJoin(User, 'invitee', 'invitee.user_id = c.invitee_id')
        .leftJoin(User, 'inviter', 'inviter.user_id = c.inviter_id')
        .select([
            'c.invitee_id AS "inviteeId"',
            'c.inviter_id AS "inviterId"',
            'c.created_at AS "createdAt"',
            'invitee.user_name AS "inviteeUserName"',
            'inviter.user_name AS "inviterUserName"',
        ])
        .where('c.tree_id = :treeId', {treeId})
        .getRawMany();

        return collabs;
    }

    // 移除协作者
    async remove(
        treeId: number,
        inviteeId: number,
        userId: number,
    ): Promise<{message: string}> {
        await this.verifyCreator(treeId, userId);

        const collab = await this.collabRepo.findOne({
            where:{treeId, inviteeId},
        });
        if(!collab) {
            throw new NotFoundException('该用户不是此族谱的协作者');
        }

        await this.collabRepo.remove(collab);
        return {message: '协作者已移除'};
    }

    // 查询我被邀请的参与的所有的族谱 
    async findMine(userId: number): Promise<any[]> {
        const collabs = await this.collabRepo
        .createQueryBuilder('c')
        .leftJoin(FamilyTree, 'f', 'f.tree_id = c.tree_id')
        .leftJoin(User, 'inviter', 'inviter.user_id = c.inviter_id')
        .select([
            'f.tree_id AS "treeId"',
            'f.tree_name AS "treeName"',
            'f.surname AS "surname"',
            'c.created_at AS "createdAt"',
            'inviter.user_name AS "inviterUserName"',
        ])
        .where('c.invitee_id = :userId', {userId})
        .orderBy('c.created_at', 'DESC')
        .getRawMany();

        return collabs;
    }
}