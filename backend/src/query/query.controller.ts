import { Controller, Get, Param, UseGuards,ParseIntPipe,Request, Query, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from '../auth/auth.guard';
import { QueryService } from './query.service';
import { getRandomValues } from "crypto";

@Controller('families/:treeId/query')
@UseGuards(JwtAuthGuard)
export class QueryController{
    constructor(private readonly queryService: QueryService) {}

    // GET /families/:treeId/query/ancestors/:memberId
    // 查询某个成员的所有的祖先
    @Get('ancestors/:memberId')
    findAncestors(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
        @Request() req,
    ){
        return this.queryService.findAncestors(treeId, memberId, req.user.userId);
    }

    // GET /families/:treeId/query/descendants/:memberId
    // 查询某个成员的所有的后代
    @Get('descendants/:memberId')
    findDescendants(
        @Param('treeId',ParseIntPipe) treeId: number,
        @Param('memberId', ParseIntPipe) memberId: number,
        @Request() req,
    ){
        return this.queryService.findDescendants(treeId, memberId, req.user.userId);
    }

    // GET /families/:treeId/query/path?from=1&to=5
    // 查询两个人之间的亲缘路径
    @Get('path')
    findPath(
        @Param('treeId', ParseIntPipe) treeId: number,
        @Query('from') fromStr: string,
        @Query('to') toStr : string,
        @Request() req,
    ){
        const fromId = parseInt(fromStr);
        const toId = parseInt(toStr);

        if(isNaN(fromId) || isNaN(toId)) {
            throw new BadRequestException('from和to参数必须是数字');
        }

        return this.queryService.findPath(treeId, fromId, toId, req.user.userId);
    }

    //GET /families/:treeId/query/stats
    // 获取族谱的统计信息
    @Get('stats')
    getStats(
        @Param('treeId',ParseIntPipe) treeId:number,
        @Request() req,
    ){
        return this.queryService.getStats(treeId, req.user.userId);
    }
}
