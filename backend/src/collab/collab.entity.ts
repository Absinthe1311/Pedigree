import { Column, CreateDateColumn, PrimaryColumn,Entity } from "typeorm";


@Entity('collab')
export class Collab{
    
    //联合主键tree_id + invitee_id
    @PrimaryColumn({name: 'tree_id'})
    treeId: number;

    @PrimaryColumn({name: 'invitee_id'})
    inviteeId: number;

    @Column({name:'inviter_id'})
    inviterId: number;

    @CreateDateColumn({name: 'created_at'})
    createdAt: Date;
}