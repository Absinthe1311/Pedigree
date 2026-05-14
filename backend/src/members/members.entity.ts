import{ Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('members')
export class Member {
    
    @PrimaryGeneratedColumn({ name: "member_id"})
    memberId: number;

    // 外键：关联到family_tree的tree_id
    // 只存储tree_id的数值，不自动加载完整的family_tree对象
    @Column({name: "tree_id"})
    treeId: number;

    @Column({name: "name", length:100})
    name: string;

    @Column({name: "gender", length:10, nullable: true})
    gender: string; // '男'，'女','unknown'

    @Column({name: "birth", nullable: true, type:'date'})
    birth: string;      // 格式：YYYY-MM-DD

    @Column({name:"death", nullable: true, type:'date'})
    death: string;        // 格式 YYYY-MM-DD

    @Column({name:"bio", nullable:true, type:'text'})
    bio:string;

    // 父亲的member_id,自引用外键
    @Column({name:"father_id", nullable:true})
    fatherId: number;

    // 母亲的member_id，自引用外键
    @Column({name:"mother_id", nullable:true})
    motherId: number;

    @Column({name: "generation", nullable:true})
    generation: number; //世代
 
}