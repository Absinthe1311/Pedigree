import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateMarriageDto } from "./dto/create-marriage.dto";
import { Marriage } from "./marriages.entity";
import { Repository } from 'typeorm';
import { FamiliesService } from "../families/families.service";
import { MembersService } from "../members/members.service";
import { UpdateMarriageDto } from "./dto/update-marriage.dto";

@Injectable()
export class MarriagesService {

    constructor(
        @InjectRepository(Marriage)
        private readonly marriageRepo: Repository<Marriage>,

        // 需要使用familiesService
        private readonly familiesService: FamiliesService,

        // 需要使用membersService
        private readonly membersService: MembersService,
    ){}

    // 判断当前的用户是否有资格编辑这个族谱来添加婚姻关系
    private async verifyFamilyAccess(treeId: number, userId: number) {
        await this.familiesService.findOne(treeId, userId);
    }

    // 业务约束逻辑
    private async validateConstraints(
        member1Id: number,
        member2Id: number,
        marryDate?: string,
        divorceDate?: string,
    ){
        // 1.不能与自己结婚
        if(member1Id == member2Id) {
            throw new BadRequestException('两位结婚成员不能是同一个人');
        }
        // 2. 有离婚日期之前必须有结婚日期
        if(!marryDate && divorceDate)
        {
            throw new BadRequestException('填写离婚日期前需要有结婚日期');
        }
        // 3. 结婚日期必须早于离婚日期
        if(marryDate && divorceDate && marryDate >= divorceDate) {
            throw new BadRequestException('结婚日期必须早于离婚日期');
        }
    }

    // 创建婚姻
    async create(
        treeId: number,
        dto: CreateMarriageDto,
        userId: number,
    ): Promise<Marriage> {
        await this.verifyFamilyAccess(treeId, userId);

        // 验证两个成员都属于对应的familytree中
        await this.membersService.findOne(treeId, dto.member1Id, userId);
        await this.membersService.findOne(treeId, dto.member2Id, userId);

        // 自动排序，确保member1Id < member2Id，满足数据库的约束
        const [member1Id, member2Id] = [dto.member1Id, dto.member2Id].sort(
            (a,b) => a-b,
        ) as [number, number];

        // 业务约束
        this.validateConstraints(member1Id, member2Id, dto.marryDate, dto.divorceDate);

        // 检查其中的一个人是否已经有婚姻记录
        const activeMember1 = await this.marriageRepo
        .createQueryBuilder('m')
        .where('(m.member1_id = :id OR m.member2_id = :id)',{id:member1Id})
        .andWhere('m.divorceDate IS NULL')
        .getOne();

        if(activeMember1){
            throw new ConflictException(`成员${member1Id}目前已有婚姻关系`);
        }

        const activeMember2 = await this.marriageRepo
        .createQueryBuilder('m')
        .where('(m.member1_id = :id OR m.member2_id = :id)',{id:member2Id})
        .andWhere('m.divorceDate is NULL')
        .getOne();
        
        if(activeMember2){
            throw new ConflictException(`成员${member2Id}目前已经有婚姻关系`);
        }

        // 创建并保存这个婚姻信息
        const marriage = this.marriageRepo.create({
            member1Id,
            member2Id,
            marryDate: dto.marryDate ?? null,
            divorceDate: dto.divorceDate ?? null,
        });

        return this.marriageRepo.save(marriage);
    }

    // 查找族谱内的所有婚姻关系
    async findAll(treeId: number, userId: number): Promise<Marriage[]>{
        await this.verifyFamilyAccess(treeId, userId);

        // 拿到这个族谱中的所有的成员的ID
        const members = await this.membersService.findAll(treeId, userId);
        const membersIds = members.map((m)=>m.memberId);

        if(membersIds.length === 0) return [];

        //查找member1Id或者member2Id在族谱成员范围内的婚姻记录
        //member1Id < member2Id,然后婚姻中的两个人一定在同一个族谱中，所以只要member1Id在我的membersIds中即可确定这个婚姻在我的这个族谱中
        return this.marriageRepo
        .createQueryBuilder('m')
        .where('m.member1_id IN (:...ids)', {ids:membersIds})
        .orderBy('m.marry_date', 'ASC')
        .getMany();
    }

    // 查询单条婚姻关系
    async findOne(treeId: number, marriageId: number, userId: number): Promise<Marriage>{
        await this.verifyFamilyAccess(treeId, userId);

        const marriage = await this.marriageRepo.findOne({
            where: {marriageId},
        });

        if(!marriage){
            throw new NotFoundException('婚姻关系不存在');
        }

        return marriage;
    }

    // 修改婚姻关系
    async update(
        treeId: number,
        marriageId: number,
        dto: UpdateMarriageDto,
        userId: number,
    ): Promise<Marriage>{
        const marriage = await this.findOne(treeId, marriageId, userId);

        // 用修改后的值做约束检查
        const newMarryDate = dto.marryDate;
        const newDivorceDate = dto.divorceDate;

        this.validateConstraints(
            marriage.member1Id,
            marriage.member2Id,
            newMarryDate?? undefined,
            newDivorceDate ?? undefined
        );

        if(dto.marryDate !== undefined) marriage.marryDate = dto.marryDate;
        if(dto.divorceDate !== undefined) marriage.divorceDate = dto.divorceDate;

        return this.marriageRepo.save(marriage);
    }

    // 删除婚姻关系
    async remove(
        treeId: number,
        marriageId: number,
        userId: number,
    ):Promise<{message: string}> {
        const marriage = await this.findOne(treeId, marriageId, userId);

        await this.marriageRepo.remove(marriage);

        return {message:"婚姻关系已经删除"};
    }
}