// TypeORM 通过这个类知道数据库中有一张users表，以及其中有什么字段
import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';

@Entity('users')  // 对应数据库中的名为 users 的表
export class User {

    @PrimaryGeneratedColumn({ name: 'user_id'}) // 主键，自增列
    userId: number; // 对应user_id列，自增主键

    @Column({ name: 'user_name', unique: true, length : 50}) // 普通字段
    userName: string; // 对应user_naem列，唯一约束

    @Column({ length : 255 }) // 普通字段
    password: string; // 存储加密后的密码，永远不存储明文
}