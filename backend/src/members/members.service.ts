
import { Injectable, NotFoundException } from '@nestjs/common';
import{ Member } from './members.entity'
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm'
import { CreateMemberDto } from './dto/create-member.dto'
import { FamiliesService } from '../families/families.service';
import { UpdateMemberDto } from './dto/update-member.dto';


@Injectable()
export class MembersService {
    
    constructor(
        @InjectRepository(Member)
        private readonly memberRepo: Repository<Member>,

        // 需要FamiliesService中的findOne方法
        private readonly familiesService: FamiliesService,
    ){}

    // 检验用户对族谱的访问权限（创作者或者协作者）
    private async verifyFamilyAccess(treeId: number, userId: number){
        await this.familiesService.findOne(treeId, userId);
    }

    // 创建成员
    async create(
        treeId: number, // 传入族谱的ID
        dto: CreateMemberDto, // 传入其中的人员信息
        userId: number
    ): Promise<Member>{
        await this.verifyFamilyAccess(treeId, userId);

        const member = this.memberRepo.create({
            treeId:treeId,
            name:dto.name,
            gender:dto.gender,
            birth:dto.birth,
            death:dto.death,
            bio:dto.bio,
            fatherId:dto.fatherId,
            motherId:dto.motherId,
            generation:dto.generation
            });
        return this.memberRepo.save(member);
    }

    // 查询族谱内的所有成员(支持姓名的模糊匹配)
    // 如果传入了姓名则模糊匹配，否则返回全部的人员信息
    async findAll(
        treeId:number, 
        userId:number,
        name?:string,
    ): Promise<Member[]>{
        await this.verifyFamilyAccess(treeId, userId);

        return this.memberRepo.find({
            where:{
                treeId,
                ...(name ?{name:Like(`%${name}%`)} : {}),
                // 这个...的功能就是进行一个拆解并拼接到上一层的功能
                // 先判断是否为空？如果不为空，将name:Like(`%${name}%`)
                // 作为条件添加到上面的treeId:treeId后面
                // 注意这个里面是反串引号 `
            },
            order:{generation:'ASC', name:'ASC'},
        });
    }

    // 查询族谱内单个成员的信息
    async findOne(
        treeId: number,
        memberId: number,
        userId: number,
    ): Promise<Member>{
        await this.verifyFamilyAccess(treeId, userId);

        const member = await this.memberRepo.findOne({
            where:{memberId, treeId},
        });

        if(!member){
            throw new NotFoundException('成员不存在');
        }

        return member;
    }
    
    // 修改成员信息
    async update(
        treeId: number,
        memberId: number,
        dto: UpdateMemberDto,
        userId: number,
    ):Promise<Member>{
        // await this.verifyFamilyAccess(treeId, userId); findOne里面有检验内容

        const member = await this.findOne(treeId, memberId, userId);

        Object.assign(member, dto);

        return this.memberRepo.save(member);
    }

    // 删除成员
    async remove(
        treeId: number,
        memberId: number,
        userId: number,
    ): Promise<{message: string}>{
        // await this.verifyFamilyAccess(treeId, userId); findOne里面有检验内容

        const member = await this.findOne(treeId, memberId, userId);
        // console.log("找到的member:",member);    
        await this.memberRepo.remove(member);

        return {message:'成员已删除'};
    }
}