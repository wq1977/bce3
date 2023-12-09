<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import moment from 'moment'
import { Icon } from '@iconify/vue';
import { useProjectStore } from '../stores/project';

const props = defineProps(['project'])
const router = useRouter()
const deleteConfirm = ref(false)
let toDelete = null
const store = useProjectStore()

function doDelete(proj) {
    deleteConfirm.value = true
    toDelete = proj
}

const eTitle = computed(() => `E${props.project.albumIndex ? props.project.albumIndex >= 10 ? props.project.albumIndex + 1 : `0${props.project.albumIndex + 1}` : '01'}`)

function fmtDate(ts) {
    return moment(ts).format('YYYY-MM-DD')
}

async function handleAction() {
    await store.deleteProject(toDelete)
}

</script>
<template>
    <div @click="router.push(`/editor/paragraph?id=${project.id}`)"
        class="group relative border cursor-pointer rounded m-2 p-2 flex flex-col w-[200px]">
        <span :title="`${eTitle} ${project.name || project.id}`" :data-publish="!project.unpublish"
            class="mr-5 bg-transparent data-[publish=false]:text-gray-500 text-xl font-black text-ellipsis overflow-hidden truncate">
            <span class="font-normal text-xs text-gray-500 mr-2">{{ eTitle }}</span>
            <span>{{ project.name || project.id }}</span>
        </span>
        <span class="text-xs my-2 text-gray-500 flex-1 line-clamp-2">{{ project.desc }}</span>
        <div class="flex items-center">
            <span class="text-xs text-gray-500/50 flex-1">{{ fmtDate(project.updateat) }}</span>
            <Icon v-if="project.unpublish"
                @click.stop="project.unpublish = false; store.saveProject(project); store.doPublish(project)" title="下架"
                icon="fa-solid:arrow-up" class="group-hover:inline hidden mr-1 text-gray-500 hover:text-gray-800" />
            <Icon v-else @click.stop="project.unpublish = true; store.saveProject(project); store.doPublish(project)"
                title="下架" icon="fa-solid:arrow-down"
                class="group-hover:inline hidden mr-1 text-gray-500 hover:text-gray-800" />
            <Icon @click.stop="doDelete(project)" title="删除" icon="fluent:delete-12-regular"
                class="group-hover:inline hidden mr-1 text-gray-500 hover:text-gray-800" />
        </div>
        <AlertDialogRoot v-model:open="deleteConfirm">
            <AlertDialogPortal>
                <AlertDialogOverlay class="bg-black-gray-900 data-[state=open]:animate-overlayShow fixed inset-0 z-30" />
                <AlertDialogContent
                    class="z-[100] text-[15px] data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
                    <AlertDialogTitle class="text-mauve12 m-0 text-[17px] font-semibold">
                        确定要删除项目 {{ toDelete.name || toDelete.id }} 吗?
                    </AlertDialogTitle>
                    <AlertDialogDescription class="text-mauve11 mt-4 mb-5 text-[15px] leading-normal">
                        和项目相关的所有文件将被删除并且不可恢复.
                    </AlertDialogDescription>
                    <div class="flex justify-end gap-[25px]">
                        <AlertDialogCancel
                            class="text-mauve11 bg-mauve4 hover:bg-mauve5 focus:shadow-mauve7 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-semibold leading-none outline-none focus:shadow-[0_0_0_2px]">
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            class="text-red11 bg-red4 hover:bg-red5 focus:shadow-red7 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-semibold leading-none outline-none focus:shadow-[0_0_0_2px]"
                            @click="handleAction">
                            确定
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialogPortal>
        </AlertDialogRoot>
    </div>
</template>