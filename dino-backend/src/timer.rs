use std::{collections::HashMap, rc::Rc, time::Duration, time::SystemTime};
use uuid::Uuid;

pub struct Timer<T> {
    timers: HashMap<Uuid, Rc<(SystemTime, fn(T), bool)>>,
}

impl<T> Timer<T> {
    pub fn new() -> Self {
        Self {
            timers: HashMap::new(),
        }
    }

    pub fn set_timeout(&mut self, f: fn(T), duration: Duration) -> Uuid {
        let id = Uuid::new_v4();
        self.timers
            .insert(id, Rc::new((SystemTime::now() + duration, f, false)));

        id
    }

    pub fn exec_timers(&mut self, args: T) {
        let timers = self.timers.clone();
        for (id, rc) in timers {
            if SystemTime::now() > rc.0 {
                rc.1(args)
            }
            self.timers.remove(&id);
        }
    }
}

#[cfg(test)]
fn timer_test() {
    type TimerArg<'a> = (&'a mut f32, &'a mut i32);
    let mut timer: Timer<TimerArg> = Timer::new();

    timer.set_timeout(
        |arg| {
            *arg.0 += 1.0 / 3.0;
            *arg.1 += 1;
        },
        Duration::from_secs(1000),
    )
}
