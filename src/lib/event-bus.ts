type EventCallbackFn = (arg?: any) => void;
export default class EventBus {
  defineEvent: Record<string, (EventCallbackFn | null)[]> = {};
  // 注册事件
  register(name: string, cb: EventCallbackFn) {
    if (!this.defineEvent[name]) {
      this.defineEvent[name] = [cb];
    } else {
      this.defineEvent[name].push(cb);
    }
  }

  // 派遣事件
  dispatch(event: string, arg?: any) {
    if (this.defineEvent[event]) {
      for (let i=0, len = this.defineEvent[event].length; i<len; ++i) {
        if (this.defineEvent[event]?.[i]) {
          this.defineEvent[event][i]?.(arg);
        }
      }
    }
  }

  // on 监听
  on(event: string, cb: EventCallbackFn) {
    return this.register(event, cb); 
  }

  // off 方法
  off(event: string, cb: EventCallbackFn) {
    if(this.defineEvent[event]) {
      if(typeof(cb) === "undefined") { 
        delete this.defineEvent[event]; // 表示全部删除 
      } else {
        // 遍历查找 
        for(let i=0, len=this.defineEvent[event].length; i<len; ++i) { 
          if(cb === this.defineEvent[event][i]) {
            this.defineEvent[event][i] = null; // 标记为空 - 防止dispath 长度变化 
            // 延时删除对应事件
            setTimeout(() => {
              if (this.defineEvent[event]) {
                this.defineEvent[event].splice(i, 1);
              }
            }, 0);
            break;
          }
        }
      }
    }
  }

  // once 方法，监听一次
  once(event: string, cb: EventCallbackFn) { 
    const onceCb = arg => {
      if (cb) {
        cb(arg);
      } 
      this.off(event, onceCb); 
    }
    this.register(event, onceCb); 
  }

  // 清空所有事件
  clean() {
    this.defineEvent = {}; 
  }
}

export const eventBus = new EventBus();
