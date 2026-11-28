import type {
  Cause, HelpConfig, NewMessage, Message, Page, Payment, PostMessageResult, StartPaymentInput, Stats,
} from './types'

export interface Api {
  listMessages(p: { cursor?: string; limit: number }): Promise<Page<Message>>
  postMessage(i: NewMessage): Promise<PostMessageResult>
  getStats(): Promise<Stats>
  /** count: تعداد صلوات دسته‌ای (۱ تا ۱۰۰) */
  addSalavat(count?: number): Promise<Stats>
}

export interface HelpApi {
  listCauses(p: { q?: string }): Promise<Cause[]>
  getCause(id: string): Promise<Cause>
  startPayment(i: StartPaymentInput): Promise<{ payUrl: string }>
  listMyPayments(clientId: string): Promise<Payment[]>
  getHelpTotal(): Promise<{ totalToman: number }>
  getConfig(): Promise<HelpConfig>
}
