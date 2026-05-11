import { Body, Controller, Post, UseGuards,Request, Get, Param, ParseIntPipe, Patch, Delete } from "@nestjs/common";
import { JwtAuthGuard } from '../auth/auth.guard';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from "./dto/create-family.dto";
import { UpdateFamilyDto } from "./dto/update-family.dto";
import { transformAuthInfo } from "passport";

@Controller('families') // 这个地方定义基础路径
@UseGuards(JwtAuthGuard)
export class FamiliesController{

    constructor(private readonly familiesService : FamiliesService) {}

    // POST /families
    // 创建新族谱，当前的登录用户成为族谱的创建者
    @Post()
    create(@Body() dto: CreateFamilyDto, @Request() req) {
        // 这个将Body放到我的dto中，我的Request放到我的req中
        // req.user由 JwtStrategy.validate()注入，包含{userId, userName}
        return this.familiesService.create(dto, req.user.userId);
    }

    // Get /families
    // 获取当前用户的所有族谱
    @Get()
    findAll(@Request() req) {
        // 这个req中有我的userId以及我的userName
        return this.familiesService.findAllByUser(req.user.userId);
    }

    // Get /families/:id
    // 获取用户的单个族谱详情
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Request() req){
        // ParseIntPipe自动把URL里的字符串1转换成数字1
        return this.familiesService.findOne(id, req.user.userId);
    }

    // PATCH /families/:id
    // 修改族谱名称或姓氏
    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateFamilyDto,
        @Request() req
    ){
        return this.familiesService.update(id, dto, req.user.userId);
    }

    // DELETE /families/:id
    @Delete(':id')
    // 删除族谱(仅创建者可以删除)
    remove(@Param('id', ParseIntPipe) id:number, @Request() req)
    {
        return this.familiesService.remove(req.user.userId, id);
    }
}