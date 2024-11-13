<script setup>
import { Icon } from '@iconify/vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import WordAdjust from '../component/WordAdjust.vue'
import Draggable from 'vuedraggable'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
const paraRefs = ref(null)
const editor = ref(null)
const doAdjust = ref(false)
const adjustLeft = ref(0)
const adjustTop = ref(0)
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}

function resort() {
    project.value.paragraphs.sort((a, b) => a.start - b.start).forEach(p => p.sequence = 0)
    store.saveParagraph(project.value)
}

const titlelist = computed({
    get: () => {
        const list = store.getContentBlocks(project.value).map(b => ({
            ...b
        }))
        let duration = 0;
        for (let block of list) {
            duration += block.duration
            block.duration = store.formatDuration(duration)
        }
        return list
    },
    set: (list) => {
        list.forEach((p, idx) => {
            project.value.paragraphs[p.index].sequence = idx + 1
        })
        store.saveParagraph(project.value)
    }
})

async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
    // await store.loadTracks(project.value)
    // project.value.words = store.fixLongWord(project.value.words, store.projectTrackLen(project.value))
    // await store.saveWords(project.value)
}

async function setComment(event, paragraphIdx) {
    const text = event.target.textContent.trim()
    if (text || paragraphIdx == 0) {
        project.value.paragraphs[paragraphIdx].comment = text
        store.saveParagraph(project.value);
    } else {
        store.mergeBackParagraph(project.value, paragraphIdx)
    }
}

function preventEnter(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.target.blur()
    }
}

function paragraphKeyDown(e, paragraphIdx, piece) {
    if (e.code == 'Enter') {
        const position = rangeWordStart
        store.splitParagraph(project.value, paragraphIdx, piece, position)
    }
}

function focusParagraph(idx) {
    paraRefs.value[idx].scrollIntoView({ behavior: "smooth", });
}


const selWordStart = ref(null)
const selWordEnd = ref(null)
const selParagraph = ref(null)

watch(() => selWordEnd.value, () => {
    console.log('selword change to:', selWordEnd.value)
})

// function adjustWords(e) {
//     const posx = e.clientX
//     const posy = e.clientY + 30
//     const rect = editor.value.getBoundingClientRect()
//     adjustLeft.value = Math.min(posx - rect.left, window.innerWidth - 800)
//     adjustTop.value = Math.min(posy - rect.top, rect.height - 200)
//     setTimeout(() => {
//         doAdjust.value = true
//         const unwatch = watch(doAdjust, () => {
//             unwatch()
//             store.updateParagraphsPieces(project.value, selParagraph.value)
//         })
//     }, 100);
// }

function playSelection() {
    store.playWords(project.value, selWordStart.value, selWordEnd.value)
}

function playFromHere() {
    if (dbPlayFrom != null) {
        store.playWords(project.value, dbPlayFrom, project.value.words.length)
    }
}

let clickWaitConfirm = false
let dbPlayFrom = null
function onTxtDbclick() {
    clickWaitConfirm = false
    playFromHere()
}

function setSelectionTag(tag) {
    if (selWordStart.value != null && selWordEnd.value != null) {
        store.setTag(project.value, selWordStart.value, selWordEnd.value, tag)
    }
}

function setSelectionHot(value) {
    if (selWordStart.value != null && selWordEnd.value != null) {
        store.setHot(project.value, selParagraph.value, selWordStart.value, selWordEnd.value, value)
    }
}

let selectRange = ref(null)
let highlight = new Highlight(), rangeWordStart = 0, rangeWordEnd = 0
watch(selectRange, () => {
    highlight.clear()
    if (selectRange.value) {
        highlight.add(selectRange.value)
    }
})
CSS.highlights.set("user-1-highlight", highlight);
function clearSelection(e) {
    highlight.clear()
    selectRange.value = null
}

function selectTrack(index, track) {
    if (project.value.paragraphs[index].track == track) {
        project.value.paragraphs[index].track = ''
    } else {
        project.value.paragraphs[index].track = track
    }
    project.value.paragraphs[index] = { ...project.value.paragraphs[index] }
    store.saveParagraph(project.value)
}

function pieceMouseup(e) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    let nodeBase = range.startContainer
    if (nodeBase.nodeName !== 'SPAN') {
        nodeBase = nodeBase.parentNode
    }
    const paragraphIdxBase = parseInt(nodeBase.getAttribute('data-paragraph'))
    if (isNaN(paragraphIdxBase)) {
        highlight.clear()
        selectRange.value = null
        return;
    }
    const pieceIdxBase = parseInt(nodeBase.getAttribute('data-piece'))
    const wordBase = store.getWordIndex(project.value, project.value.paragraphs[paragraphIdxBase].pieces[pieceIdxBase], range.startOffset)

    clickWaitConfirm = true
    dbPlayFrom = wordBase
    setTimeout(async () => {
        if (clickWaitConfirm) {
            selParagraph.value = paragraphIdxBase
            if (store.stop) {
                await store.stop()
                await new Promise(r => setTimeout(r, 300))
            }
            if (selectRange.value) {
                if (wordBase > rangeWordStart) {
                    rangeWordEnd = wordBase
                    range.setStart(selectRange.value.startContainer, selectRange.value.startOffset)
                } else {
                    rangeWordEnd = rangeWordStart
                    rangeWordStart = wordBase
                    range.setStart(range.startContainer, Math.max(0, range.startOffset - 1))
                    range.setEnd(selectRange.value.startContainer, selectRange.value.startOffset)
                }
            } else {
                range.setStart(range.startContainer, Math.max(0, range.startOffset - 1))
                range.setEnd(range.endContainer, range.endOffset)
                rangeWordStart = wordBase
            }
            selWordStart.value = Math.max(0, wordBase - 3)
            selWordEnd.value = wordBase + 3
            selectRange.value = range
        }
    }, 300);
}

</script>
<template>
    <div v-if="project" ref="editor" class="relative flex-1 flex flex-col">
        <div class="text-2xl font-black antialiased p-2">
            <input v-model="project.name" @change="store.saveProject(project)" placeholder="请输入单集标题" />
        </div>
        <div class="pr-[320px] flex-1 flex flex-col" @click="clearSelection">
            <div class="border max-h-[calc(100vh-320px)] py-2 px-1 bg-gray-100">
                <div class="max-h-[calc(100vh-320px-1rem)] overflow-y-auto">
                    <div ref="paraRefs" v-for="(paragraph, idx) in project.paragraphs"
                        class="text-justify leading-relaxed p-2 focus:outline-none " :key="paragraph.start">
                        <div>
                            <span contenteditable @keydown="preventEnter" @blur="setComment($event, idx)"
                                :data-used="store.isValidParagraph(paragraph)"
                                class="font-black text-gray-300 data-[used=true]:text-green-600 mr-2 px-1">
                                {{ `${paragraph.comment || '未命名'}` }}</span>
                            <Icon @click="store.playParagraph(project, paragraph)" icon="zondicons:play-outline"
                                class="inline mr-2" />
                            <DropdownMenuRoot v-if="project.patches && project.patches.length">
                                <DropdownMenuTrigger class="select-none">
                                    <Icon class="inline mr-2" icon="arcticons:lspatch" title="Patch" />
                                </DropdownMenuTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuContent
                                        class="min-w-[100px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                                        :side-offset="5">
                                        <DropdownMenuItem
                                            @click.stop="store.setParagraphPatch(project, paragraph, false)"
                                            class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1">
                                            清除
                                        </DropdownMenuItem>
                                        <DropdownMenuItem v-for="patch in project.patches"
                                            @click.stop="store.setParagraphPatch(project, paragraph, patch.name)"
                                            class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1">
                                            {{ patch.name }}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenuPortal>
                            </DropdownMenuRoot>
                            <span>&nbsp;&nbsp;</span>
                            <span v-for="(piece, pidx) in paragraph.pieces" :data-paragraph="idx" :data-piece="pidx"
                                :data-tag="paragraph.patch ? 'patch' : piece.type ? piece.type.split('-')[0] : 'normal'"
                                @dblclick="onTxtDbclick" @click.stop="pieceMouseup" :data-ishot="piece.ishot"
                                @keydown="paragraphKeyDown($event, idx, piece)" tabindex="0"
                                class="leading-loose select-none break-all focus:outline-none decoration-4 decoration-dashed data-[tag=patch]:bg-yellow-200 data-[tag=mute]:underline data-[tag=beep]:line-through data-[ishot=true]:bg-orange-200 data-[tag=beep]:decoration-wavy data-[tag=beep]:text-blue-600 data-[tag=delete]:line-through data-[tag=delete]:text-red-600 antialiased">
                                {{ piece.text }} </span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-1 h-[180px] bg-gray-100 flex items-center justify-center flex-col pb-4 border">
                <div class="flex justify-end w-full p-2">
                    <Icon @click.stop="store.setTag(project, rangeWordStart - 1, rangeWordEnd, '')"
                        class="rounded-full p-[4px] stroke-gray-300 text-gray-300 hover:stroke-black hover:text-black fill-gray-200 border w-[2em] h-[2em] bg-white hover:bg-gray-300"
                        icon="tabler:wave-sine" title="Normal" />
                    <Icon @click.stop="store.setTag(project, rangeWordStart - 1, rangeWordEnd, 'delete')"
                        class="rounded-full p-[4px] stroke-gray-300 text-gray-300 hover:stroke-black hover:text-black fill-gray-200 border w-[2em] h-[2em] bg-white hover:bg-gray-300"
                        icon="fluent:delete-off-20-filled" title="Delete" />
                    <Icon @click.stop="store.setTag(project, rangeWordStart - 1, rangeWordEnd, 'beep')"
                        class="rounded-full p-[4px] stroke-gray-300 text-gray-300 hover:stroke-black hover:text-black fill-gray-200 border w-[2em] h-[2em] bg-white hover:bg-gray-300"
                        icon="typcn:waves" title="Beep" />
                    <Icon @click.stop="store.setTag(project, rangeWordStart - 1, rangeWordEnd, 'mute')"
                        class="rounded-full p-[4px] stroke-gray-300 text-gray-300 hover:stroke-black hover:text-black fill-gray-200 border w-[2em] h-[2em] bg-white hover:bg-gray-300"
                        icon="mdi:minus" title="Mute" />

                    <DropdownMenuRoot>
                        <DropdownMenuTrigger class="select-none">
                            <Icon
                                class="rounded-full p-[4px] stroke-gray-300 text-gray-300 hover:stroke-black hover:text-black fill-gray-200 border w-[2em] h-[2em] bg-white hover:bg-gray-300"
                                icon="arcticons:lspatch" title="Patch" />
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuContent
                                class="min-w-[100px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                                :side-offset="5">
                                <DropdownMenuItem v-for="patch in project.patches"
                                    @click.stop="store.setTag(project, rangeWordStart - 1, rangeWordEnd, `patch-${patch.name}`)"
                                    class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1">
                                    {{ patch.name }}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuPortal>
                    </DropdownMenuRoot>
                </div>
                <WordAdjust class="flex-1" @afterEdit="clearSelection" :from="selWordStart" :to="selWordEnd"
                    :projectid="project.id" />
            </div>
        </div>

        <div v-if="store.stop" class="fixed right-1 bottom-1 z-10">
            <button @click="() => { store.stop(); store.stop = null }"
                class="w-[70px] h-[70px] rounded-full border-2 hover:bg-gray-600 bg-gray-600/70 text-white">stop</button>
        </div>

        <div class="fixed right-[20px] top-[100px]  border-[1px] p-2 bg-gray-100">
            <div @click="resort" class="text-lg p-2 text-gray-600 antialiased font-bold">故事大纲：</div>
            <div class="max-h-[80vh] overflow-y-auto w-[300px]">

                <Draggable v-model="titlelist" item-key="title">
                    <template #item="{ element }">
                        <div @click="focusParagraph(element.index)"
                            class="text-sm bg-gray-100 cursor-grab border-2 mb-1 rounded p-2 text-ellipsis overflow-hidden whitespace-nowrap antialiased flex">
                            <span class="font-mono font-thin text-gray-500"> {{ element.duration }} </span>
                            &nbsp;
                            <ContextMenuRoot>
                                <ContextMenuTrigger class="select-none">
                                    <span class="font-bold">{{ element.title }} </span>
                                </ContextMenuTrigger>
                                <ContextMenuPortal>
                                    <ContextMenuContent
                                        class="min-w-[100px] z-30 bg-white outline-none rounded-md p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=top]:animate-slideDownAndFade data-[side=right]:animate-slideLeftAndFade data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade"
                                        :side-offset="5">
                                        <ContextMenuCheckboxItem
                                            :checked="!element.track || element.track == track.name"
                                            @select="selectTrack(element.index, track.name)"
                                            v-for="track in project.tracks"
                                            class="group text-[13px] leading-none text-grass11 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1">
                                            <ContextMenuItemIndicator
                                                class="absolute left-0 w-[25px] inline-flex items-center justify-center">
                                                <Icon icon="radix-icons:check" />
                                            </ContextMenuItemIndicator> {{ track.name }}
                                        </ContextMenuCheckboxItem>
                                    </ContextMenuContent>
                                </ContextMenuPortal>
                            </ContextMenuRoot>
                        </div>
                    </template>
                </Draggable>
            </div>
        </div>
    </div>
</template>

<style>
::highlight(user-1-highlight) {
    background-color: black;
    color: yellow;
}
</style>