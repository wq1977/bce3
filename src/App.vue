<script setup>
import { ref } from 'vue'
import { openDialog, inputDialogLabel, inputDialogTitle, inputbtn, inputvalue } from './global'

</script>
<template>
    <div>
        <DialogRoot v-model:open="openDialog">
            <DialogPortal>
                <DialogOverlay class="bg-blackA9 data-[state=open]:animate-overlayShow fixed inset-0 z-30" />
                <DialogContent
                    class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[100]">
                    <DialogTitle class="text-mauve12 m-0 text-[17px] font-semibold">
                        {{ inputDialogTitle }}
                    </DialogTitle>
                    <DialogDescription class="text-mauve11 mt-[10px] mb-5 text-[15px] leading-normal">
                        {{ inputDialogLabel }}
                    </DialogDescription>
                    <fieldset class="mb-[15px] flex items-center gap-5">
                        <input id="name" v-model="inputvalue"
                            class="text-grass11 shadow-green7 focus:shadow-green8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]"
                            defaultValue="Pedro Duarte">
                    </fieldset>
                    <div class="mt-[25px] flex justify-end">
                        <DialogClose as-child>
                            <button @click="inputbtn = 1; openDialog = false"
                                class="bg-green4 text-green11 hover:bg-green5 focus:shadow-green7 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-semibold leading-none focus:shadow-[0_0_0_2px] focus:outline-none">
                                确定
                            </button>
                        </DialogClose>
                    </div>
                    <DialogClose
                        class="text-grass11 hover:bg-green4 focus:shadow-green7 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
                        aria-label="Close">
                        <Icon icon="lucide:x" />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </DialogRoot>

        <router-view></router-view>
    </div>
</template>