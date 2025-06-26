declare const routes: ({
    id: string;
    channel: string;
    handler: () => {
        message: string;
        timestamp: number;
        server: string;
    };
} | {
    id: string;
    channel: string;
    handler: () => {
        hello: string;
        timestamp: number;
        pid: number;
    };
} | {
    id: string;
    channel: string;
    handler: () => {
        users: {
            id: number;
            name: string;
            email: string;
        }[];
        count: number;
        timestamp: number;
    };
} | {
    id: string;
    channel: string;
    handler: () => {
        posts: {
            id: number;
            title: string;
            content: string;
        }[];
        count: number;
        timestamp: number;
    };
} | {
    id: string;
    channel: string;
    handler: () => {
        status: string;
        uptime: number;
        memory: number;
        timestamp: number;
    };
})[];
declare const server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
export { server, routes };
