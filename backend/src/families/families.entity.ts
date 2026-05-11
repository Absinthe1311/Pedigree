// 把数据库中的family_trees映射成TypeScript类，TypeORM通过它读写数据库
import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn} from 'typeorm'

@Entity('family_trees')
export class FamilyTree {
    
    @PrimaryGeneratedColumn({name:"tree_id"})
    treeId: number;

    @Column({name:"tree_name", length: 255})
    treeName: string;

    @Column({name:"surname", length: 50})
    surname: string;

    @Column({name:"creator_id"})
    creatorId: number;

    @CreateDateColumn({name:"create_time"})
    createTime: Date;

    @UpdateDateColumn({name:"update_time"})
    updateTime: Date;
}