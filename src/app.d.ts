import { CyreLog } from './components/cyre-logger';
import type { ActionId, ActionPayload, BreathingMetrics, CyreResponse, EventHandler, IO, Subscriber, SubscriptionResponse, TimekeeperMetrics } from './interfaces/interface';
interface CyreInstance {
    initialize: () => CyreResponse;
    call: (id?: ActionId, payload?: ActionPayload) => Promise<CyreResponse>;
    action: (attribute: IO | IO[]) => void;
    on: (type: string | Subscriber[], fn?: EventHandler) => SubscriptionResponse;
    shutdown: () => void;
    status: () => boolean;
    forget: (id: string) => boolean;
    get: (id: string) => IO | undefined;
    pause: (id?: string) => void;
    resume: (id?: string) => void;
    hasChanged: (id: string, payload: ActionPayload) => boolean;
    getPreviousPayload: (id: string) => ActionPayload | undefined;
    getBreathingState: () => Readonly<BreathingMetrics>;
    getPerformanceState: () => {
        totalProcessingTime: number;
        totalCallTime: number;
        totalStress: number;
        stress: number;
    };
    getMetrics: (channelId: string) => TimekeeperMetrics;
}
declare const Cyre: (line?: string) => CyreInstance;
declare const cyre: CyreInstance;
export { Cyre, cyre, CyreLog };
export default cyre;
