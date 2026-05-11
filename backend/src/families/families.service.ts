// 实现族谱的增删改查功能
import { ForbiddenException,NotFoundException, Injectable } from "@nestjs/common";
import { FamilyTree } from './families.entity';
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateFamilyDto } from './dto/create-family.dto'
import { UpdateFamilyDto } from './dto/update-family.dto'

@Injectable()
export class FamiliesService {

    constructor(
        @InjectRepository(FamilyTree)
        private readonly familyRepo: Repository<FamilyTree>,
        // 这里的familyRepo是TypeORM提供的操作family_tree表的方法
        // 可以调用findOne, save, create等方法
    ){}

    // 创建家谱
    async create(dto: CreateFamilyDto, creatorId: number): Promise<FamilyTree>{
        const family = this.familyRepo.create({
            treeName: dto.treeName,
            surname: dto.surname,
            creatorId
        });
        return this.familyRepo.save(family);
    }

    // 查询当前用户的所有族谱
    // 返回“我创建的”族谱列表 （协作族谱在collab模块中处理）
    async findAllByUser(userId: number): Promise<FamilyTree[]>
    {
        return this.familyRepo.find({
            where:{creatorId: userId},
            order:{updateTime:'DESC'}
        });
    }

    // 查询单个族谱的详情
    async findOne(treeId: number, userId: number): Promise<FamilyTree>
    {
        const family = await this.familyRepo.findOne({where:{treeId}});

        if(!family) {
            throw new NotFoundException('族谱不存在');
        }

        // 权限校验： 只有当前创建者可以访问
        // 后续collab模块完成之后，受邀者也可以访问
        if(family.creatorId !== userId){
            throw new ForbiddenException('无权访问该族谱');
        }

        return family;
    }

    // 修改族谱
    async update(
        treeId: number,
        dto: UpdateFamilyDto,
        userId: number,
    ): Promise<FamilyTree>{
        const family = await this.findOne(treeId, userId);

        // 只更新传入的新的字段
        if(dto.treeName !== undefined) family.treeName = dto.treeName;
        if(dto.surname !== undefined) family.surname = dto.surname;

        return this.familyRepo.save(family);
    }

    // 删除族谱 
    // 只有创建者可以删除，并输出删除信息
    async remove(userId: number, treeId: number): Promise<{message: string}> {
        const family = await this.findOne(treeId, userId);

        // 数据库设置了ON DELETE CASCADE， 删除族谱会自动级联删除所有成员和协作记录
        await this.familyRepo.remove(family);

        return {message: '族谱已经删除'}
    }
}