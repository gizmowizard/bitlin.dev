<script lang="ts" module>
    import { Icon as LIcon } from "@lucide/svelte";
    import {
        cabinetFiling,
        treesForest,
        mailboxFlag,
        pinSafety,
        coinsStack,
        toolbox2,
        bucket,
    } from "@lucide/lab";
    import GitBranch from "@lucide/svelte/icons/git-branch";
    import GitBranchPlus from "@lucide/svelte/icons/git-branch-plus";
    import GitCommitHorizontal from "@lucide/svelte/icons/git-commit-horizontal";
    import GitCompare from "@lucide/svelte/icons/git-compare";
    import GitCompareArrows from "@lucide/svelte/icons/git-compare-arrows";
    import GitFork from "@lucide/svelte/icons/git-fork";
    import GitMerge from "@lucide/svelte/icons/git-merge";
    import GitMergeConflict from "@lucide/svelte/icons/git-merge-conflict";
    import GitPullRequest from "@lucide/svelte/icons/git-pull-request";
    import GitPullRequestArrow from "@lucide/svelte/icons/git-pull-request-arrow";
    import GitPullRequestClosed from "@lucide/svelte/icons/git-pull-request-closed";
    import GitPullRequestCreate from "@lucide/svelte/icons/git-pull-request-create";
    import Tag from "@lucide/svelte/icons/tag";
    import Tags from "@lucide/svelte/icons/tags";
    import History from "@lucide/svelte/icons/history";
    import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
    import File from "@lucide/svelte/icons/file";
    import FilePlus from "@lucide/svelte/icons/file-plus";
    import FileMinus from "@lucide/svelte/icons/file-minus";
    import FileDiff from "@lucide/svelte/icons/file-diff";
    import FileText from "@lucide/svelte/icons/file-text";
    import Folder from "@lucide/svelte/icons/folder";
    import FolderOpen from "@lucide/svelte/icons/folder-open";
    import FolderGit2 from "@lucide/svelte/icons/folder-git-2";
    import Users from "@lucide/svelte/icons/users";
    import User from "@lucide/svelte/icons/user";
    import Settings from "@lucide/svelte/icons/settings";
    import KeyRound from "@lucide/svelte/icons/key-round";
    import Lock from "@lucide/svelte/icons/lock";
    import Globe from "@lucide/svelte/icons/globe";
    import Eye from "@lucide/svelte/icons/eye";
    import Clock from "@lucide/svelte/icons/clock";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import Upload from "@lucide/svelte/icons/upload";
    import Download from "@lucide/svelte/icons/download";
    import Plus from "@lucide/svelte/icons/plus";
    import X from "@lucide/svelte/icons/x";
    import Check from "@lucide/svelte/icons/check";
    import Search from "@lucide/svelte/icons/search";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import Copy from "@lucide/svelte/icons/copy";
    import Pencil from "@lucide/svelte/icons/pencil";
    import LogOut from "@lucide/svelte/icons/log-out";
    import Link from "@lucide/svelte/icons/link";
    import ArrowLeft from "@lucide/svelte/icons/arrow-left";
    import ArrowRight from "@lucide/svelte/icons/arrow-right";
    import CircleAlert from "@lucide/svelte/icons/circle-alert";
    import Info from "@lucide/svelte/icons/info";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Send from "@lucide/svelte/icons/send";
    import Rocket from "@lucide/svelte/icons/rocket";
    import Image from "@lucide/svelte/icons/image";
    import Code from "@lucide/svelte/icons/code";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import Undo2 from "@lucide/svelte/icons/undo-2";
    import Columns2 from "@lucide/svelte/icons/columns-2";
    import Rows2 from "@lucide/svelte/icons/rows-2";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import Ellipsis from "@lucide/svelte/icons/ellipsis";
    import Server from "@lucide/svelte/icons/server";
    import CloudUpload from "@lucide/svelte/icons/cloud-upload";
    import CloudDownload from "@lucide/svelte/icons/cloud-download";
    import Layers from "@lucide/svelte/icons/layers";
    import Shield from "@lucide/svelte/icons/shield";
    import WifiOff from "@lucide/svelte/icons/wifi-off";
    import CircleDot from "@lucide/svelte/icons/circle-dot";
    import MapPin from "@lucide/svelte/icons/map-pin";
    import Calendar from "@lucide/svelte/icons/calendar";
    import FileArchive from "@lucide/svelte/icons/file-archive";
    import FileQuestion from "@lucide/svelte/icons/file-question";
    import Save from "@lucide/svelte/icons/save";
    import Eraser from "@lucide/svelte/icons/eraser";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import Hash from "@lucide/svelte/icons/hash";
    import Activity from "@lucide/svelte/icons/activity";
    import Menu from "@lucide/svelte/icons/menu";
    import House from "@lucide/svelte/icons/house";
    import Compass from "@lucide/svelte/icons/compass";
    import UserPlus from "@lucide/svelte/icons/user-plus";
    import Package from "@lucide/svelte/icons/package";

    const icons = {
        "git-branch": GitBranch,
        "git-branch-plus": GitBranchPlus,
        "git-commit-horizontal": GitCommitHorizontal,
        "git-compare": GitCompare,
        "git-compare-arrows": GitCompareArrows,
        "git-fork": GitFork,
        "git-merge": GitMerge,
        "git-merge-conflict": GitMergeConflict,
        "git-pull-request": GitPullRequest,
        "git-pull-request-arrow": GitPullRequestArrow,
        "git-pull-request-closed": GitPullRequestClosed,
        "git-pull-request-create": GitPullRequestCreate,
        tag: Tag,
        tags: Tags,
        history: History,
        "archive-restore": ArchiveRestore,
        file: File,
        "file-plus": FilePlus,
        "file-minus": FileMinus,
        "file-diff": FileDiff,
        "file-text": FileText,
        folder: Folder,
        "folder-open": FolderOpen,
        "folder-git-2": FolderGit2,
        users: Users,
        user: User,
        settings: Settings,
        "key-round": KeyRound,
        lock: Lock,
        globe: Globe,
        eye: Eye,
        clock: Clock,
        "trash-2": Trash2,
        upload: Upload,
        download: Download,
        plus: Plus,
        x: X,
        check: Check,
        search: Search,
        "chevron-right": ChevronRight,
        "chevron-down": ChevronDown,
        copy: Copy,
        pencil: Pencil,
        "log-out": LogOut,
        link: Link,
        "arrow-left": ArrowLeft,
        "arrow-right": ArrowRight,
        "circle-alert": CircleAlert,
        info: Info,
        "refresh-cw": RefreshCw,
        send: Send,
        rocket: Rocket,
        image: Image,
        code: Code,
        "book-open": BookOpen,
        "undo-2": Undo2,
        "columns-2": Columns2,
        "rows-2": Rows2,
        "loader-circle": LoaderCircle,
        ellipsis: Ellipsis,
        server: Server,
        "cloud-upload": CloudUpload,
        "cloud-download": CloudDownload,
        layers: Layers,
        shield: Shield,
        "wifi-off": WifiOff,
        "circle-dot": CircleDot,
        "map-pin": MapPin,
        calendar: Calendar,
        "file-archive": FileArchive,
        "file-question": FileQuestion,
        save: Save,
        eraser: Eraser,
        "rotate-ccw": RotateCcw,
        hash: Hash,
        activity: Activity,
        menu: Menu,
        house: House,
        compass: Compass,
        "user-plus": UserPlus,
        package: Package,
    };
    const lab = {
        projects: cabinetFiling,
        forest: treesForest,
        inbox: mailboxFlag,
        ignore: pinSafety,
        stack: coinsStack,
        toolbox: toolbox2,
        bucket: bucket,
    };
    export type IconName = keyof typeof icons | keyof typeof lab;
</script>

<script lang="ts">
    interface Props {
        name: IconName;
        size?: number;
        class?: string;
        strokeWidth?: number;
    }
    let {
        name,
        size = 16,
        class: cls = "",
        strokeWidth = 1.75,
    }: Props = $props();
    const Comp = $derived(
        name in icons ? icons[name as keyof typeof icons] : null,
    );
</script>

{#if Comp}
    <Comp {size} {strokeWidth} class={cls} aria-hidden="true" />
{:else}
    <LIcon
        iconNode={lab[name as keyof typeof lab]}
        {size}
        {strokeWidth}
        class={cls}
        aria-hidden="true"
    />
{/if}
