//提供族谱的查询服务，包括祖先查询，后代查询，情缘关系查询，族谱统计查询等

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FamiliesService } from "../families/families.service";
import { Member } from "../members/members.entity";
import { Marriage } from "../marriages/marriages.entity";
import { MoreThanOrEqual, Repository } from 'typeorm';

// 祖先/后代查询结果的单条记录类型
export interface MemberNode {
    memberId: number;
    name: string;
    gender: string | null;
    birth: string | null;
    death: string | null;
    generation: number | null;
    fatherId: number | null;
    motherId: number | null;
    // 相对于查询起点的层级偏移（祖先为负数，后代为正数）
    relativeLevel: number;
}

// 情缘路径中的每一步的描述
export interface PathStep {
    memberId: number;
    name: string;
    relation : string; // '父亲' 母亲 子女 配偶
}

// 族谱统计结果
export interface FamilyStats {
    totalMembers: number;
    maleCount: number;
    femalCount: number;
    unknowGenderCount: number;
    aliveCount: number;
    deceasedCount: number;
    maxGeneration: number | null;
    totalMarriages: number;
    activeMarriages: number;
}

@Injectable()
export class QueryService{

    constructor(
        @InjectRepository(Member)
        private readonly memberRepo: Repository<Member>,

        @InjectRepository(Marriage)
        private readonly marriageRepo: Repository<Marriage>,

        private readonly familiesService : FamiliesService,
    ){}

    // 权限检验
    private async verifyAccess(treeId: number, userId: number){
        await this.familiesService.findOne(treeId, userId);
    }

    // 祖先的链路查询工作
    async findAncestors(
        treeId: number,
        memberId: number,
        userId: number,
    ):Promise<MemberNode[]>{
        await this.verifyAccess(treeId, userId);

        // 起点成员
        const start = await this.memberRepo.findOne({
            where:{memberId, treeId}
        });
        if(!start) throw new NotFoundException('成员不存在');

        const result: MemberNode[] = [];
        // 待处理的队列：[当前成员ID，相对的层级]
        const queue: Array<{id:number; level: number}> = [
            {id: start.fatherId, level: -1},
            {id: start.motherId, level: -1},
        ].filter((x) => x.id != null) as Array<{id: number; level:number}>;
        // 将visited的member_id加入到里面，防止重复访问
        const visited = new Set<number>();
        while(queue.length > 0) {
            const {id, level} = queue.shift()!;
            if(visited.has(id))  continue;
            visited.add(id);

            const member = await this.memberRepo.findOne({
                where: {memberId: id, treeId}
            });
            if(!member) continue;

            result.push({
                memberId: member.memberId,
                name: member.name,
                gender: member.gender,
                birth: member.birth,
                death: member.death,
                generation: member.generation,
                fatherId: member.fatherId,
                motherId: member.motherId,
                relativeLevel: level,
            });

            // 继续向上追溯
            if(member.fatherId) queue.push({id:member.fatherId, level:level-1});
            if(member.motherId) queue.push({id:member.motherId, level: level-1});
        }
        return result;
    }

    // 后代查询
    async findDescendants(
        treeId: number,
        memberId: number,
        userId: number,
    ): Promise<MemberNode[]> {
        await this.verifyAccess(treeId, userId);

        const start = await this.memberRepo.findOne({
            where:{memberId, treeId}
        });
        if(!start) throw new NotFoundException('成员不存在');

        const result: MemberNode[] = [];
        const queue: Array<{id: number, level: number}> = [{
            id: memberId, level: 0
        }];
        const visited = new Set<number>();
        visited.add(memberId);

        while(queue.length > 0){
            const {id, level}= queue.shift()!;

            // 找出以当前成员为父亲或者母亲的所有的后代
            const children = await this.memberRepo.find({
                where:[
                    {fatherId: id, treeId},
                    {motherId: id, treeId},
                ],
            });

            for(const child of children) {
                if(visited.has(child.memberId)) continue;
                visited.add(child.memberId);

                result.push({
                    memberId: child.memberId,
                    name: child.name,
                    gender: child.gender,
                    birth: child.birth,
                    death: child.death,
                    generation: child.generation,
                    fatherId: child.fatherId,
                    motherId: child.motherId,
                    relativeLevel : level + 1,
                });

                queue.push({id: child.memberId, level: level + 1});
            }
        }

        return result;
    }

    // 亲缘链路查询
    async findPath(
        treeId: number,
        fromId: number,
        toId: number,
        userId: number,
    ): Promise<{path: PathStep[]; found: boolean}> {
        await this.verifyAccess(treeId, userId);

        if(fromId == toId) {
            const m = await this.memberRepo.findOne({
                where:{memberId: fromId,
                    treeId
                }
            });
            if(!m) throw new NotFoundException('用户不存在');
            return {
                found:true,
                path:[{memberId: m.memberId, name: m.name, relation:'本人'}],
            };
        }

        // 拉取族谱内的所有成员和婚姻关系，构建临界表
        const allMembers = await this.memberRepo.find({
            where:{treeId}
        });

        const allMarriages = await this.marriageRepo
        .createQueryBuilder('m')
        .where('m.member1_id IN (:...ids)',{
            ids:allMembers.map((m) => m.memberId),
        })
        .getMany();

        // memberMap: memberId->member对象，方便快速查找
        const memberMap = new Map(allMembers.map((m)=>[m.memberId, m]));

        // 构建邻接表：Map<memberId, Array<{neighborId, relation>}
        const graph = new Map<number, Array<{id:number; relation: string}>>();

        const addEdge = (a:number, b:number, relAtoB: string, relBtoA: string)=>
        {
            if(!graph.has(a)) graph.set(a, []);
            if(!graph.has(b)) graph.set(b, []);
            graph.get(a)!.push({id:b, relation: relAtoB});
            graph.get(b)!.push({id:a, relation: relBtoA});
        };

        // 血缘边
        for (const member of allMembers) {
            if(member.fatherId) {
                addEdge(member.memberId, member.fatherId, '父亲', '子女');
            }
            if(member.motherId) {
                addEdge(member.memberId, member.motherId, '母亲', '子女');
            }
        }

        // 婚姻边
        for (const marriage of allMarriages){
            addEdge(marriage.member1Id, marriage.member2Id, '配偶', '配偶');
        }

        // BFS寻路
        // prev:记录每个节点的前驱[prevId, relation]
        const prev = new Map<number, {prevId:number; relation:string}>();
        const visited = new Set<number>();
        const bfsQueue: number[] = [fromId];
        visited.add(fromId);

        let found = false;  

        while(bfsQueue.length > 0) {
            const current = bfsQueue.shift()!;
            if(current == toId) {found = true; break;}

            const neighbors = graph.get(current) ?? [];
            for(const {id, relation} of neighbors){
                if(visited.has(id)) continue;
                visited.add(id);
                prev.set(id, {prevId:current, relation});
                bfsQueue.push(id);
            }
        }

        if(!found) {
            return {found:false, path:[]};
        }

        //回溯路径
        const path: PathStep[] = [];
        let cur = toId;
        while(cur !== fromId){
            const {prevId, relation} = prev.get(cur)!;
            const member = memberMap. get(cur)!;
            path.unshift({memberId:member.memberId, name:member.name,relation});
            cur = prevId;
        }
        // 加入起点
        const startMember = memberMap.get(fromId);
        path.unshift({memberId:startMember.memberId, name:startMember.name, relation:'本人'});

        return {found: true, path};
    } 


    // 族谱统计
    async getStats(treeId:number, userId: number): Promise<FamilyStats>{
        await this.verifyAccess(treeId, userId);
        const members = await this.memberRepo.find({where:{treeId}});
        const memberIds = members.map((m) => m.memberId);

        // 婚姻统计
        let totalMarriages = 0;
        let activeMarriages = 0;
        if(memberIds.length > 0) {
            totalMarriages = await this.marriageRepo
            .createQueryBuilder('m')
            .where('m.member1_id IN (...ids)', {ids:memberIds})
            .getCount();

            activeMarriages = await this.marriageRepo
            .createQueryBuilder('m')
            .where('m.member1_id IN (:...ids)', {ids:memberIds})
            .andWhere('m.divorce_date IS NULL')
            .getCount();
        }

        const generations = members.map((m) => m.generation)
        .filter((g)=>g!=null) as number[];

        return {
            totalMembers: members.length,
            maleCount: members.filter((m)=>m.gender === '男').length,
            femalCount: members.filter((m)=>m.gender === '女').length,
            unknowGenderCount: members.filter((m) => !m.gender || m.gender == 'unknown').length,
            aliveCount: members.filter((m) => m.death == null) .length,
            deceasedCount:members.filter((m) => m.death != null).length,
            maxGeneration: generations.length > 0? Math.max(...generations) : null,
            totalMarriages,
            activeMarriages,
        };
    }
}