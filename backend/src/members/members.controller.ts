import { ParseIntPipe, Body, Controller, Post, UseGuards,Request, Param, Get, Query, Patch, Delete } from "@nestjs/common";
import {JwtAuthGuard} from '../auth/auth.guard';
import {MembersService} from './members.service';
import { CreateMemberDto } from "./dto/create-member.dto";
import { TreeChildren } from "typeorm";
import { UpdateMemberDto } from "./dto/update-member.dto";


@Controller('families/:treeId/members') //这个地方定义基础路径
@UseGuards(JwtAuthGuard) // 检查是否登录
export class MembersController{

    constructor(private readonly membersService: MembersService) {}

    // POST /families/:treeId/members
    // 在指定的族谱中添加成员
    @Post()
    create(
        @Body() dto:CreateMemberDto, 
        @Request() req,
        @Param('treeId', ParseIntPipe) treeId: number,
    ){
        return this.membersService.create(treeId, dto, req.user.userId);
    }

    // GET /families/:treeId/members?name=张
    // 获取族谱内的所有的成员，可以通过输入的姓名进行模糊匹配工作
    @Get()
    findAll(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Query('name') name:string,
        @Request() req,
    ){
        // console.log("获取到的name:",name); 获取的name没有问题
        return this.membersService.findAll(treeId, req.user.userId, name);
    }

    // GET /families/:treeId/members/:memberId
    // 获取单个成员的详情
    @Get(':memberId')
    findOne(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
        @Request() req,
    ){
        return this.membersService.findOne(treeId, memberId, req.user.userId);
    }

    // PATCH /families/:treeId/members/:memberId
    // 修改单个成员的信息
    @Patch(':memberId')
    update(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
        @Body() dto: UpdateMemberDto,
        @Request() req,
    ){
        return this.membersService.update(treeId, memberId, dto, req.user.userId);
    }

    // DELETE /families/:treeId/members/:memberId
    @Delete(':memberId')
    remove(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
        @Request() req,
    ){
        return this.membersService.remove(treeId, memberId, req.user.userId);
    }
}
