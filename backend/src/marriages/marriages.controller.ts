import { Body, Controller, Param, Post, UseGuards, ParseIntPipe, Request, Get, Patch, Delete } from "@nestjs/common";
import {JwtAuthGuard} from '../auth/auth.guard';
import { CreateMarriageDto } from "./dto/create-marriage.dto";
import {MarriagesService } from './marriages.service';
import { TreeChildren } from "typeorm";
import { UpdateMarriageDto } from "./dto/update-marriage.dto";

@Controller('families/:treeId/marriages')
@UseGuards(JwtAuthGuard)
export class MarriagesController{

    constructor(private readonly marriagesService: MarriagesService){}

    // POST /families/:treeId/marriages
    // 增加一条婚姻关系
    @Post()
    create(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Body() dto: CreateMarriageDto,
        @Request() req,
    ){
        return this.marriagesService.create(treeId, dto, req.user.userId);
    }

    // GET /families/:treeId/marriages
    // 获取族谱内的所有的婚姻关系
    @Get()
    findAll(
        @Param('treeId', ParseIntPipe) treeId:number,
        @Request() req,
    ){
        return this.marriagesService.findAll(treeId, req.user.userId);
    }

    // GET /families/:treeId/marriages/:marriageId
    // 获取一条婚姻记录的详情
    @Get(':marriageId')
    findOne(
        @Param('treeId', ParseIntPipe) treeId : number,
        @Param('marriageId', ParseIntPipe) marriageId: number,
        @Request() req,
    ){
        return this.marriagesService.findOne(treeId, marriageId,req.user.userId);
    }

    // PATCH /families/:treeId/marriages/:marriageId
    // 修改婚姻的日期信息
    @Patch(':marriageId')
    update(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('marriageId', ParseIntPipe) marriageId: number,
        @Body() dto: UpdateMarriageDto,
        @Request() req
    ){
        return this.marriagesService.update(treeId, marriageId, dto, req.user.userId); 
    }

    // DELETE /families/:treeId/marriages/:marriageId
    // 删除对应的婚姻记录
    @Delete(':marriageId')
    remove(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('marriageId', ParseIntPipe) marriageId: number,
        @Request() req
    ){
        return this.marriagesService.remove(treeId, marriageId, req.user.userId);
    }
    
}