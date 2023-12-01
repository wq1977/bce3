<script setup>
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router';
const route = useRoute()
</script>
<template>
    <NavigationMenuRoot class="left-0 right-0 top-[30px] flex justify-center">
        <NavigationMenuList
            class="center shadow-gray-300 m-0 flex list-none rounded-[6px] bg-white p-1 shadow-[0_2px_10px]">
            <NavigationMenuItem>
                <NavigationMenuLink :data-active="route.path == '/editor/track'" as-child
                    class="data-[active=true]:text-sky-600 text-gray-500  hover:bg-gray-100 focus:shadow-green-700 group flex select-none items-center justify-between gap-[2px] rounded-[4px] px-3 py-2 text-[15px] font-medium leading-none outline-none ">
                    <RouterLink :to="`/editor/track?id=${route.query.id}`">
                        <span class="border-2 mr-1 w-[1em] h-[1em] flex items-center justify-center rounded-full "><span
                                class="text-xs">1</span></span>
                        素材
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
                <NavigationMenuLink :data-active="route.path == '/editor/paragraph'" as-child
                    class="data-[active=true]:text-sky-600 text-gray-500  hover:bg-gray-100 focus:shadow-green-700 group flex select-none items-center justify-between gap-[2px] rounded-[4px] px-3 py-2 text-[15px] font-medium leading-none outline-none ">
                    <RouterLink :to="`/editor/paragraph?id=${route.query.id}`">
                        <span class="border-2  mr-1 w-[1em] h-[1em] flex items-center justify-center rounded-full "><span
                                class="text-xs">2</span></span>
                        段落
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
                <NavigationMenuLink :data-active="route.path == '/editor/project'" as-child
                    class="data-[active=true]:text-sky-600 text-gray-500 hover:bg-gray-100 focus:shadow-green-700 group flex select-none items-center justify-between gap-[2px] rounded-[4px] px-3 py-2 text-[15px] font-medium leading-none outline-none ">
                    <RouterLink :to="`/editor/project?id=${route.query.id}`">
                        <span class="border-2  mr-1 w-[1em] h-[1em] flex items-center justify-center rounded-full "><span
                                class="text-xs">3</span></span>
                        音乐
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
                <NavigationMenuLink :data-active="route.path == '/editor/publish'" as-child
                    class="data-[active=true]:text-sky-600 text-gray-500 hover:bg-gray-100 focus:shadow-green-700 group flex select-none items-center justify-between gap-[2px] rounded-[4px] px-3 py-2 text-[15px] font-medium leading-none outline-none ">
                    <RouterLink :to="`/editor/publish?id=${route.query.id}`">
                        <span class="border-2  mr-1 w-[1em] h-[1em] flex items-center justify-center rounded-full "><span
                                class="text-xs">4</span></span>
                        发布
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
                <NavigationMenuLink as-child
                    class="data-[active=true]:text-sky-600 text-gray-500 hover:bg-gray-100 focus:shadow-green-700 group flex select-none items-center justify-between gap-[2px] rounded-[4px] px-3 py-2 text-[15px] font-medium leading-none outline-none ">
                    <RouterLink :to="`/`">
                        <Icon icon="tabler:arrow-back" class="text-green-600" />
                    </RouterLink>
                </NavigationMenuLink>
            </NavigationMenuItem>

        </NavigationMenuList>
        <NavigationMenuViewport />
    </NavigationMenuRoot>
    <router-view></router-view>
</template>