import client from './client';
import type {FamilyTree} from '../types/family'

// 创建族谱
export const createFamily = (data:{treeName: string; surname:string}) =>
    client.post<FamilyTree>('/families', data).then((res) => res.data);

// 获取我的族谱列表
export const getFamilies = () =>
    client.get<FamilyTree[]>('/families').then((res) => res.data);

// 获取单个族谱的详情
export const getFamily = (id:number) =>
    client.get<FamilyTree>(`/families/${id}`).then((res) => res.data);

// 修改族谱
export const updateFamily = (
    id:number,
    data: {treeName?:string; surname?:string},
) => client.patch<FamilyTree>(`/families/${id}`,data).then((res) => res.data);

// 删除族谱
export const deleteFamily = (id:number) =>
    client.delete<{message: string}>(`/families/${id}`).then((res)=>res.data);