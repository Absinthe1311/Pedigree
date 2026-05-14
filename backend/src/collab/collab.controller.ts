import { Body, Controller, Param, Post, UseGuards,Request,ParseIntPipe, Get, Delete } from "@nestjs/common";
import {CollabService} from './collab.service'
import {JwtAuthGuard} from '../auth/auth.guard'
import { MongoInvalidArgumentError } from "typeorm";
import { CreateCollabDto } from "./dto/create-collab.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class CollabController {
    constructor(private readonly collabService: CollabService) {}

    // POST /families/:treeId/collab
    //邀请用户成为协作者
    @Post('families/:treeId/collab')
    MongoInvalidArgumentError(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Body() dto: CreateCollabDto,
        @Request() req,
    ){
        return this.collabService.invite(treeId, dto, req.user.userId);
    }

    //GET /families/:treeId/collab
    //获取族谱的所有的协作者列表
    @Get('families/:treeId/collab')
    findAll(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Request() req,

    ){
        return this.collabService.findAll(treeId, req.user.userId);
    }

    //DELETE /families/:treeId/collab/:inviteeId
    // 移除某个协作者
    @Delete('families/:treeId/collab/:inviteeId')
    remove(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('inviteeId', ParseIntPipe) inviteeId: number,
        @Request() req ,
    ){
        return this.collabService.remove(treeId, inviteeId, req.user.userId);
    }

    // GET /collab/mine
    // 获取我被邀请参与的所有族谱
    @Get('collab/mine')
    findMine(@Request() req) {
        return this.collabService.findMine(req.user.userId);
    }
}