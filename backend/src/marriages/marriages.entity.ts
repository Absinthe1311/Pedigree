import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marriages')
export class Marriage {

    @PrimaryGeneratedColumn({name:"marriage_id"})
    marriageId: number;

    // 婚礼的两位成员的ID， 数据库约束有member1_id < member2_id
    @Column({name:"member1_id"})
    member1Id: number;

    @Column({name:"member2_id"})
    member2Id: number;

    @Column({name:"marry_date", type:'date', nullable:true})
    marryDate: string; //结婚日期，格式为YYYY-MM-DD，可以为null

    @Column({name:"divorce_date", type:"date", nullable:true})
    divorceDate: string; //离婚日期 YYYY-MM-DD，未离婚则为null
}