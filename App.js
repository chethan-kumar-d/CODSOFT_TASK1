import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Platform, StatusBar, SafeAreaView,
  KeyboardAvoidingView, BackHandler,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const TASK_KEY = "codsoft_taskflow_v1";
const NAME_KEY = "taskflow_name";

const C = {
  bg: "#F7F6FC",
  ink: "#28223F",
  muted: "#827C96",
  purple: "#7655DA",
  violet: "#A38AEE",
  dark: "#34245F",
  coral: "#EF786A",
  mint: "#208875",
  border: "#ECE7F5",
  lavender: "#EEE8FB",
};

const PRIORITY = {
  High: "#C64F65",
  Medium: "#946715",
  Low: "#208875",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORIES = ["Personal", "Study", "Work", "Health"];

const CATEGORY_ICONS = {
  Personal: "person-outline",
  Study: "book-outline",
  Work: "briefcase-outline",
  Health: "fitness-outline",
};

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function pretty(value) {
  return value ? value.split("-").reverse().join("-") : "No deadline";
}

function dayDifference(value, today) {
  const a = fromKey(value);
  const b = fromKey(today);
  return Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000
  );
}

function timeLabel(value) {
  if (!value) return "Any time";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function taskProgress(task) {
  if (task.completed) return 100;
  const steps = task.subtasks || [];
  return steps.length
    ? Math.round(steps.filter((step) => step.done).length / steps.length * 100)
    : 0;
}

function Icon({ name, size = 22, color = C.purple }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function IconButton({ name, onPress, label, dark = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.iconButton, dark && { backgroundColor: "#FFFFFF18" }]}
    >
      <Icon name={name} color={dark ? "white" : C.purple} />
    </TouchableOpacity>
  );
}

function Button({ title, onPress, light = false, disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        s.button,
        light && s.lightButton,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, light && { color: C.purple }]}>
        {title}
      </Text>
      {!light && <Icon name="arrow-forward" color="white" size={18} />}
    </TouchableOpacity>
  );
}

function Rocket({ large = false }) {
  return (
    <View style={[s.rocketArt, large && s.largeArt]}>
      <View style={[s.orbit, large && s.largeOrbit]} />
      <View style={[s.innerOrbit, large && s.largeInnerOrbit]} />
      <View style={{ transform: [{ rotate: "-25deg" }] }}>
        <Icon name="rocket" size={large ? 112 : 66} color={large ? "white" : C.purple} />
      </View>
      <View style={s.artStar}>
        <Icon name="sparkles" size={large ? 30 : 20} color="#FFD89B" />
      </View>
      <View style={s.artFlame}>
        <Icon name="flame" size={large ? 45 : 27} color={C.coral} />
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState("Chethu");
  const [nameDraft, setNameDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [storageOK, setStorageOK] = useState(false);
  const [notice, setNotice] = useState("");

  const [now, setNow] = useState(Date.now());
  const today = dateKey(new Date(now));

  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Date");

  const [panel, setPanel] = useState(null);
  const [calendarTarget, setCalendarTarget] = useState("task");
  const [month, setMonth] = useState(new Date());

  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("Personal");
  const [dueDate, setDueDate] = useState("");
  const [time, setTime] = useState("");
  const [steps, setSteps] = useState([]);
  const [stepText, setStepText] = useState("");
  const [error, setError] = useState("");

  const writes = useRef(Promise.resolve());
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [raw, savedName] = await Promise.all([
          AsyncStorage.getItem(TASK_KEY),
          AsyncStorage.getItem(NAME_KEY),
        ]);
        if (raw) {
          const data = JSON.parse(raw);
          if (!Array.isArray(data)) throw new Error("Invalid saved data");
          setTasks(data);
        }
        if (savedName) setName(savedName);
        setStorageOK(true);
      } catch {
        setNotice("Saved data could not be loaded. Changes stay in this session.");
      } finally {
        setLoaded(true);
      }
    })();

    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loaded || !storageOK) return;
    const snapshot = JSON.stringify(tasks);
    writes.current = writes.current.then(async () => {
      try {
        await AsyncStorage.setItem(TASK_KEY, snapshot);
        setNotice("");
      } catch {
        setNotice("Could not save changes. Check your device storage.");
      }
    });
  }, [tasks, loaded, storageOK]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [screen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panel) {
        setPanel(null);
        return true;
      }
      if (screen !== "home" && screen !== "welcome") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, panel]);

  const selected = tasks.find((task) => task.id === selectedId);
  const active = tasks.filter((task) => !task.completed);
  const completed = tasks.length - active.length;
  const overall = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const isHome = screen === "home";
  const isList = screen === "tasks";

  function sorted(list) {
    return [...list].sort((a, b) => {
      if (sort === "Priority") {
        const ranks = { High: 0, Medium: 1, Low: 2 };
        return ranks[a.priority] - ranks[b.priority];
      }
      return `${a.dueDate || "9999"} ${a.time || "23:59"}`
        .localeCompare(`${b.dueDate || "9999"} ${b.time || "23:59"}`);
    });
  }

  function matches(task) {
    const text = `${task.title} ${task.description || ""} ${task.category || "Personal"}`;
    if (!text.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "Active") return !task.completed;
    if (filter === "Completed") return task.completed;
    if (filter === "High") return !task.completed && task.priority === "High";
    return true;
  }

  const filtered = sorted(tasks.filter(matches));
  const daily = filtered.filter((task) => task.dueDate === selectedDay);
  const featured = sorted(active)[0];

  function deadline(task) {
    if (task.completed) return "Completed";
    if (!task.dueDate) return "No deadline";

    if (task.time) {
      const due = fromKey(task.dueDate);
      const [hour, minute] = task.time.split(":").map(Number);
      due.setHours(hour, minute, 0, 0);
      const delta = due.getTime() - now;
      if (delta < 0) return "Overdue";
      const minutes = Math.ceil(delta / 60000);
      if (minutes < 60) return minutes ? `${minutes} min left` : "Due now";
    }

    const days = dayDifference(task.dueDate, today);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Tomorrow";
    return `${days} days left`;
  }

  function edit(task = null) {
    setEditId(task ? task.id : null);
    setTitle(task ? task.title : "");
    setDescription(task ? task.description || "" : "");
    setPriority(task ? task.priority : "Medium");
    setCategory(task ? task.category || "Personal" : "Personal");
    setDueDate(task ? task.dueDate || today : selectedDay);
    setTime(task ? task.time || "" : "");
    setSteps(task ? (task.subtasks || []).map((step) => ({ ...step })) : []);
    setStepText("");
    setError("");
    setScreen("form");
  }

  function addStep() {
    if (!stepText.trim()) return;
    setSteps((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random()}`, text: stepText.trim(), done: false },
    ]);
    setStepText("");
  }

  function save() {
    if (!title.trim()) {
      setError("Please enter a task name.");
      return;
    }
    if (!dueDate) {
      setError("Please choose a due date.");
      return;
    }
    const cleanTime = time.trim();
    if (cleanTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cleanTime)) {
      setError("Use 24-hour time, for example 09:30 or 22:15.");
      return;
    }

    const finalSteps = stepText.trim()
      ? [...steps, { id: `${Date.now()}-last`, text: stepText.trim(), done: false }]
      : steps;

    const fields = {
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      dueDate,
      time: cleanTime,
      subtasks: finalSteps,
    };

    setTasks((current) => editId
      ? current.map((task) => task.id === editId ? { ...task, ...fields } : task)
      : [{
          ...fields,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          completed: false,
          completedOn: null,
        }, ...current]
    );
    setSelectedDay(dueDate);
    setScreen("home");
  }

  function toggle(id) {
    setTasks((current) => current.map((task) =>
      task.id === id
        ? {
            ...task,
            completed: !task.completed,
            completedOn: task.completed ? null : dateKey(new Date()),
          }
        : task
    ));
  }

  function toggleSubtask(id) {
    setTasks((current) => current.map((task) =>
      task.id === selectedId
        ? {
            ...task,
            completed: false,
            completedOn: null,
            subtasks: (task.subtasks || []).map((step) =>
              step.id === id ? { ...step, done: !step.done } : step
            ),
          }
        : task
    ));
  }

  function openDetails(task) {
    setSelectedId(task.id);
    setScreen("details");
  }

  function openCalendar(target) {
    setCalendarTarget(target);
    const value = target === "task" ? dueDate : selectedDay;
    const date = value ? fromKey(value) : new Date();
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setPanel("calendar");
  }

  function selectDate(value) {
    if (calendarTarget === "task") setDueDate(value);
    else {
      setSelectedDay(value);
      setScreen("home");
    }
    setPanel(null);
  }

  function header(text) {
    return (
      <View style={[s.between, { marginBottom: 26 }]}>
        <IconButton name="arrow-back" label="Back" onPress={() => setScreen("home")} />
        <Text style={s.pageTitle}>{text}</Text>
        <View style={{ width: 44 }} />
      </View>
    );
  }

  function renderTask(task, index) {
    const highlight = index === 0 && !task.completed;
    return (
      <View key={task.id} style={s.timelineRow}>
        <View style={s.rail}>
          <View style={[
            s.railDot,
            task.completed && { backgroundColor: C.mint, borderColor: C.mint },
          ]} />
          <View style={s.railLine} />
        </View>

        <View style={[s.taskCard, highlight && s.taskHighlight]}>
          <View style={s.between}>
            <View style={s.inline}>
              <View style={[s.categoryIcon, highlight && { backgroundColor: "#FFFFFF20" }]}>
                <Icon
                  name={CATEGORY_ICONS[task.category || "Personal"]}
                  size={13}
                  color={highlight ? "white" : C.purple}
                />
              </View>
              <Text style={[s.categoryText, highlight && { color: "#EDE5FF" }]}>
                {task.category || "Personal"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggle(task.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.completed }}
              accessibilityLabel={`Complete ${task.title}`}
              style={{ padding: 5 }}
            >
              <Icon
                name={task.completed ? "checkmark-circle" : "ellipse-outline"}
                color={task.completed ? C.mint : highlight ? "white" : "#B9AFCF"}
                size={25}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => openDetails(task)} accessibilityRole="button">
            <Text numberOfLines={2} style={[
              s.taskTitle,
              highlight && { color: "white" },
              task.completed && { textDecorationLine: "line-through", color: C.muted },
            ]}>{task.title}</Text>

            {!!task.description && (
              <Text numberOfLines={1} style={[
                s.taskNote,
                highlight && { color: "#E9DFFF" },
              ]}>{task.description}</Text>
            )}

            <View style={[s.between, { marginTop: 15 }]}>
              <View style={s.inline}>
                <Icon name="time-outline" size={13} color={highlight ? "#E9DFFF" : C.muted} />
                <Text style={[s.tiny, highlight && { color: "#E9DFFF" }]}>
                  {timeLabel(task.time)}
                </Text>
              </View>
              <View style={[
                s.priorityBadge,
                { backgroundColor: highlight ? "#FFFFFF20" : `${PRIORITY[task.priority]}12` },
              ]}>
                <Text style={{
                  fontSize: 9,
                  fontWeight: "800",
                  color: highlight ? "white" : PRIORITY[task.priority],
                }}>{task.priority}</Text>
              </View>
            </View>

            {isList && (
              <Text style={[
                s.tiny,
                { marginTop: 10 },
                highlight && { color: "#E9DFFF" },
              ]}>Due {pretty(task.dueDate)} · {deadline(task)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const year = month.getFullYear();
  const mi = month.getMonth();
  const offset = new Date(year, mi, 1).getDay();
  const days = new Date(year, mi + 1, 0).getDate();

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = fromKey(selectedDay);
    date.setDate(date.getDate() + index - 3);
    return date;
  });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.app}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {!!notice && <Text style={s.warning}>{notice}</Text>}

            {screen === "welcome" && (
              <View style={s.welcome}>
                <View style={s.logo}>
                  <View style={s.logoMark}><Icon name="layers" color="white" size={20} /></View>
                  <Text style={s.logoText}>taskflow<Text style={{ color: C.coral }}>.</Text></Text>
                </View>

                <View style={s.welcomeArt}>
                  <View style={s.welcomeHalo} />
                  <View style={s.welcomePlanet}><Rocket large /></View>
                  <View style={s.floatLeft}>
                    <View style={s.mintIcon}><Icon name="checkmark" color={C.mint} size={18} /></View>
                    <View>
                      <Text style={s.floatTitle}>Little steps.</Text>
                      <Text style={s.floatCaption}>Beautiful progress.</Text>
                    </View>
                  </View>
                  <View style={s.floatRight}>
                    <Icon name="sparkles" color={C.coral} size={21} />
                    <Text style={s.floatTitle}>Make today yours</Text>
                  </View>
                </View>

                <View style={s.eyebrowPill}>
                  <View style={s.miniDot} />
                  <Text style={s.eyebrow}>YOUR SPACE TO MAKE THINGS HAPPEN</Text>
                </View>

                <Text style={s.welcomeTitle}>
                  Big dreams.{"\n"}<Text style={{ color: C.purple }}>Beautifully planned.</Text>
                </Text>
                <Text style={s.welcomeCopy}>
                  A calmer way to organise your day, focus your energy and celebrate every win.
                </Text>

                <View style={{ width: "100%", marginTop: 28 }}>
                  <Button
                    title={loaded ? "Let’s make a little progress" : "Loading your plans..."}
                    disabled={!loaded}
                    onPress={() => setScreen("home")}
                  />
                </View>
                <View style={[s.inline, { marginTop: 18 }]}>
                  <Icon name="lock-closed-outline" color={C.muted} size={12} />
                  <Text style={s.tiny}>Your plans stay on your device</Text>
                </View>
              </View>
            )}

            {(isHome || isList) && (
              <>
                <View style={s.between}>
                  <IconButton name="grid-outline" label="Menu" onPress={() => setPanel("menu")} />
                  <View style={s.logo}>
                    <Icon name="layers" size={20} />
                    <Text style={[s.logoText, { fontSize: 21 }]}>taskflow<Text style={{ color: C.coral }}>.</Text></Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setNameDraft(name);
                      setPanel("profile");
                    }}
                    style={s.avatar}
                    accessibilityLabel="Edit your name"
                  >
                    <Text style={s.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 29 }}>
                  <Text style={s.overline}>{isList ? "EVERY IDEA HAS A PLACE" : "MAKE ROOM FOR A GOOD DAY"}</Text>
                  <Text style={s.greeting}>{isList ? "All your plans" : `Hello, ${name}`}<Text style={{ color: C.coral }}>.</Text></Text>
                  <Text style={s.subtitle}>
                    {active.length} tasks to go. {completed ? `${completed} little wins already.` : "Let’s start with one small step."}
                  </Text>
                </View>

                {isHome && (
                  <View style={s.momentum}>
                    <View style={s.inline}>
                      <View style={s.momentumIcon}><Icon name="sparkles" color="#FFD3A8" size={20} /></View>
                      <View>
                        <Text style={s.momentumTitle}>Your daily momentum</Text>
                        <Text style={s.momentumCopy}>{completed} of {tasks.length} tasks completed</Text>
                      </View>
                    </View>
                    <View style={s.momentumPercent}>
                      <Text style={s.momentumPercentText}>{overall}%</Text>
                    </View>
                    <View style={s.momentumTrack}>
                      <View style={[s.momentumFill, { width: `${overall}%` }]} />
                    </View>
                  </View>
                )}

                <View style={s.search}>
                  <Icon name="search-outline" size={21} color="#ABA1BE" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    style={s.searchInput}
                    placeholder="Find something on your mind..."
                    placeholderTextColor="#978CA9"
                    accessibilityLabel="Search tasks"
                  />
                  <TouchableOpacity onPress={() => setPanel("filters")} style={s.searchFilter} accessibilityLabel="Sort tasks">
                    <Icon name="options-outline" size={19} color={C.coral} />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                  {["All", "Active", "Completed", "High"].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setFilter(value)}
                      style={[s.chip, filter === value && s.selectedChip]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === value }}
                    >
                      <Text style={[s.chipText, filter === value && { color: "white" }]}>
                        {value === "High" ? "High priority" : value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {isHome && (
                  <>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Your next focus</Text>
                      <View style={s.inline}>
                        <View style={[s.miniDot, { backgroundColor: C.mint }]} />
                        <Text style={s.tiny}>ONE STEP AT A TIME</Text>
                      </View>
                    </View>

                    {featured ? (
                      <TouchableOpacity style={s.featureCard} onPress={() => openDetails(featured)}>
                        <View style={s.between}>
                          <View style={s.featureCategory}>
                            <Icon name={CATEGORY_ICONS[featured.category || "Personal"]} size={13} />
                            <Text style={s.featureCategoryText}>{featured.category || "Personal"}</Text>
                          </View>
                          <View style={s.deadlineBadge}>
                            <Icon name="time-outline" color="#AE5548" size={11} />
                            <Text style={s.deadlineText}>{deadline(featured)}</Text>
                          </View>
                        </View>
                        <View style={s.between}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.featureTitle} numberOfLines={2}>{featured.title}</Text>
                            <Text style={s.featureDescription} numberOfLines={2}>
                              {featured.description || "A little focus now. A little closer to your goal."}
                            </Text>
                            <View style={[s.inline, { marginTop: 13 }]}>
                              <Icon name="calendar-outline" color={C.muted} size={13} />
                              <Text style={s.tiny}>{pretty(featured.dueDate)}</Text>
                            </View>
                          </View>
                          <Rocket />
                        </View>
                        <View style={[s.between, { marginTop: 15 }]}>
                          <Text style={s.tiny}>
                            {(featured.subtasks || []).length
                              ? `${featured.subtasks.filter((step) => step.done).length}/${featured.subtasks.length} steps completed`
                              : "Task progress"}
                          </Text>
                          <Text style={s.progressLabel}>{taskProgress(featured)}%</Text>
                        </View>
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${taskProgress(featured)}%` }]} />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={s.emptyFeature}>
                        <View style={s.emptyIcon}><Icon name="sparkles" size={27} /></View>
                        <Text style={s.emptyTitle}>{tasks.length ? "You’ve cleared your plans!" : "Your next chapter starts here"}</Text>
                        <Text style={s.emptyCopy}>Add a task and turn an idea into a little win.</Text>
                      </View>
                    )}

                    <View style={s.sectionHeader}>
                      <TouchableOpacity style={s.inline} onPress={() => openCalendar("day")}>
                        <Text style={s.sectionTitle}>{selectedDay === today ? "Today’s timeline" : pretty(selectedDay)}</Text>
                        <Icon name="chevron-down" size={15} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setScreen("tasks")}>
                        <Text style={s.coralLink}>See all →</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.week}>
                      {week.map((date) => {
                        const value = dateKey(date);
                        const chosen = value === selectedDay;
                        return (
                          <TouchableOpacity
                            key={value}
                            onPress={() => setSelectedDay(value)}
                            style={[s.weekDay, chosen && s.selectedDay]}
                            accessibilityLabel={pretty(value)}
                          >
                            <Text style={[s.weekLabel, chosen && { color: "#E6DCFF" }]}>
                              {["S", "M", "T", "W", "T", "F", "S"][date.getDay()]}
                            </Text>
                            <Text style={[s.weekNumber, chosen && { color: "white" }]}>{date.getDate()}</Text>
                            <View style={{
                              width: 4, height: 4, borderRadius: 2, marginTop: 6,
                              backgroundColor: tasks.some((task) => task.dueDate === value)
                                ? chosen ? "#FFD3B4" : C.purple : "transparent",
                            }} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {(isList ? filtered : daily).map(renderTask)}

                {!(isList ? filtered : daily).length && (
                  <View style={s.empty}>
                    <Icon name="leaf-outline" size={29} color="#A595C6" />
                    <Text style={s.emptyTitle}>A little breathing room</Text>
                    <Text style={s.emptyCopy}>{query ? "No tasks match your search." : "No tasks for this date or filter."}</Text>
                  </View>
                )}
              </>
            )}

            {screen === "form" && (
              <>
                {header(editId ? "Edit your plan" : "A fresh little plan")}

                <View style={s.formIntro}>
                  <View style={s.formIntroIcon}><Icon name="create-outline" size={28} /></View>
                  <Text style={s.formHeading}>Make it happen<Text style={{ color: C.coral }}>.</Text></Text>
                  <Text style={s.subtitle}>Give your next achievement a little direction.</Text>
                </View>

                <Text style={s.label}>TASK NAME *</Text>
                <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={100}
                  placeholder="What would you like to do?" placeholderTextColor="#A199B2" />

                <Text style={s.label}>YOUR NOTES</Text>
                <TextInput style={[s.input, { minHeight: 100, textAlignVertical: "top" }]}
                  value={description} onChangeText={setDescription} multiline maxLength={1000}
                  placeholder="Ideas, details, or a little motivation..." placeholderTextColor="#A199B2" />

                <Text style={s.label}>GIVE IT A HOME</Text>
                <View style={s.wrap}>
                  {CATEGORIES.map((value) => (
                    <TouchableOpacity key={value} onPress={() => setCategory(value)}
                      style={[s.categoryChip, category === value && s.selectedChip]}>
                      <Icon name={CATEGORY_ICONS[value]} size={15} color={category === value ? "white" : C.purple} />
                      <Text style={{ color: category === value ? "white" : C.purple, fontSize: 12, fontWeight: "600" }}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>DUE DATE *</Text>
                <TouchableOpacity onPress={() => openCalendar("task")} style={[s.input, s.between]}>
                  <View style={s.inline}>
                    <Icon name="calendar-outline" size={18} />
                    <Text style={{ color: C.ink }}>{pretty(dueDate)}</Text>
                  </View>
                  <Icon name="chevron-down" size={16} />
                </TouchableOpacity>

                <Text style={s.label}>TIME · OPTIONAL</Text>
                <TextInput style={s.input} value={time} onChangeText={setTime} maxLength={5}
                  keyboardType="numbers-and-punctuation" placeholder="24-hour format · e.g. 09:30 or 22:15"
                  placeholderTextColor="#A199B2" />
                {!!time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && (
                  <Text style={[s.tiny, { marginTop: 8 }]}>Selected time: {timeLabel(time)}</Text>
                )}

                <Text style={s.label}>HOW IMPORTANT IS IT?</Text>
                <View style={s.wrap}>
                  {["Low", "Medium", "High"].map((value) => (
                    <TouchableOpacity key={value} onPress={() => setPriority(value)}
                      style={[s.priorityOption, priority === value && {
                        backgroundColor: `${PRIORITY[value]}12`, borderColor: PRIORITY[value],
                      }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY[value] }} />
                      <Text style={{ color: PRIORITY[value], fontWeight: "700", fontSize: 12 }}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>SMALL STEPS · OPTIONAL</Text>
                <Text style={[s.tiny, { marginBottom: 12 }]}>Big things feel easier one small step at a time.</Text>

                {steps.map((step) => (
                  <View key={step.id} style={s.stepRow}>
                    <Icon name={step.done ? "checkmark-circle" : "ellipse-outline"} size={19} />
                    <Text style={{ flex: 1, color: C.ink, fontSize: 13 }}>{step.text}</Text>
                    <TouchableOpacity onPress={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                      accessibilityLabel="Remove subtask">
                      <Icon name="close" size={18} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={s.inline}>
                  <TextInput style={[s.input, { flex: 1 }]} value={stepText} onChangeText={setStepText}
                    placeholder="Add a small step..." placeholderTextColor="#A199B2" maxLength={150}
                    onSubmitEditing={addStep} />
                  <IconButton name="add" label="Add subtask" onPress={addStep} />
                </View>

                {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}

                <View style={{ marginTop: 30 }}>
                  <Button title={editId ? "Save your changes" : "Create my task"} onPress={save} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <Button title="Cancel" light onPress={() => setScreen("home")} />
                </View>
              </>
            )}

            {screen === "details" && selected && (
              <>
                {header("Your next little win")}
                <View style={s.detailHero}>
                  <View style={s.between}>
                    <View style={s.featureCategory}>
                      <Icon name={CATEGORY_ICONS[selected.category || "Personal"]} size={14} />
                      <Text style={s.featureCategoryText}>{selected.category || "Personal"}</Text>
                    </View>
                    <Text style={{ color: PRIORITY[selected.priority], fontSize: 11, fontWeight: "700" }}>
                      {selected.priority} priority
                    </Text>
                  </View>
                  <Text style={s.detailTitle}>{selected.title}</Text>
                  <Text style={s.detailCopy}>{selected.description || "No extra notes. Just a clear next step."}</Text>

                  <View style={s.detailInfo}>
                    <View style={s.inline}><Icon name="calendar-outline" size={17} /><Text style={s.detailValue}>Due {pretty(selected.dueDate)}</Text></View>
                    <View style={s.inline}><Icon name="time-outline" size={17} /><Text style={s.detailValue}>{timeLabel(selected.time)}</Text></View>
                    <View style={s.inline}>
                      <Icon name={selected.completed ? "checkmark-circle" : "hourglass-outline"} size={17}
                        color={selected.completed ? C.mint : C.purple} />
                      <Text style={[s.detailValue, selected.completed && { color: C.mint }]}>
                        {selected.completed
                          ? selected.completedOn ? `Completed on ${pretty(selected.completedOn)}` : "Completed"
                          : deadline(selected)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>A little closer</Text>
                  <Text style={s.progressLabel}>{taskProgress(selected)}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${taskProgress(selected)}%` }]} />
                </View>

                {(selected.subtasks || []).map((step) => (
                  <TouchableOpacity key={step.id} onPress={() => toggleSubtask(step.id)}
                    style={s.stepRow} accessibilityRole="checkbox" accessibilityState={{ checked: step.done }}>
                    <Icon name={step.done ? "checkmark-circle" : "ellipse-outline"}
                      color={step.done ? C.mint : "#B9AFCF"} />
                    <Text style={{
                      flex: 1, color: step.done ? C.muted : C.ink,
                      textDecorationLine: step.done ? "line-through" : "none",
                    }}>{step.text}</Text>
                  </TouchableOpacity>
                ))}

                {!(selected.subtasks || []).length && (
                  <Text style={[s.subtitle, { marginVertical: 20 }]}>
                    No subtasks added. Mark this task complete when you finish it.
                  </Text>
                )}

                <View style={{ marginTop: 24 }}>
                  <Button title={selected.completed ? "Reopen this task" : "Mark as completed"} onPress={() => toggle(selected.id)} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <Button title="Edit this plan" light onPress={() => edit(selected)} />
                </View>
                <TouchableOpacity onPress={() => setPanel("delete")} style={s.deleteButton}>
                  <Icon name="trash-outline" size={17} color="#BC5265" />
                  <Text style={{ color: "#BC5265", fontWeight: "600" }}>Delete task</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {(isHome || isList) && (
            <View style={s.bottomBar}>
              <TouchableOpacity onPress={() => setScreen("home")} style={s.navItem} accessibilityLabel="Home">
                <Icon name={isHome ? "home" : "home-outline"} color={isHome ? C.purple : "#A69CB7"} size={22} />
                <Text style={[s.navLabel, isHome && { color: C.purple }]}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => edit()} style={s.addButton}>
                <Icon name="add" color="white" size={20} />
                <Text style={s.addText}>Create a task</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setScreen("tasks")} style={s.navItem} accessibilityLabel="All tasks">
                <Icon name={isList ? "albums" : "albums-outline"} color={isList ? C.purple : "#A69CB7"} size={22} />
                <Text style={[s.navLabel, isList && { color: C.purple }]}>My plans</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      <Modal visible={!!panel} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={[s.between, { marginBottom: 20 }]}>
              <Text style={s.sectionTitle}>{
                { calendar: "Choose your day", profile: "Make it yours", filters: "Organise your view", menu: "Your workspace", delete: "Let this task go?" }[panel]
              }</Text>
              <IconButton name="close" label="Close" onPress={() => setPanel(null)} />
            </View>

            {panel === "calendar" && (
              <>
                <View style={[s.between, { marginBottom: 16 }]}>
                  <IconButton name="chevron-back" label="Previous month" onPress={() => setMonth(new Date(year, mi - 1, 1))} />
                  <Text style={{ color: C.ink, fontWeight: "700" }}>{MONTHS[mi]} {year}</Text>
                  <IconButton name="chevron-forward" label="Next month" onPress={() => setMonth(new Date(year, mi + 1, 1))} />
                </View>
                <View style={s.calendarGrid}>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <View key={day} style={s.dayCell}><Text style={s.tiny}>{day}</Text></View>
                  ))}
                  {Array.from({ length: offset + days }, (_, index) => {
                    const day = index - offset + 1;
                    if (day < 1) return <View key={`blank-${index}`} style={s.dayCell} />;
                    const value = dateKey(new Date(year, mi, day));
                    const chosen = value === (calendarTarget === "task" ? dueDate : selectedDay);
                    return (
                      <TouchableOpacity key={value} onPress={() => selectDate(value)} style={s.dayCell}>
                        <View style={[
                          s.dayBubble,
                          value === today && { backgroundColor: C.lavender },
                          chosen && { backgroundColor: C.purple },
                        ]}>
                          <Text style={{ color: chosen ? "white" : C.ink }}>{day}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ marginTop: 22 }}><Button title="Choose today" onPress={() => selectDate(today)} /></View>
              </>
            )}

            {panel === "profile" && (
              <>
                <Text style={[s.subtitle, { marginBottom: 16 }]}>What should we call you?</Text>
                <TextInput value={nameDraft} onChangeText={setNameDraft} placeholder="Your name" maxLength={24} style={s.input} />
                <View style={{ marginTop: 20 }}>
                  <Button title="Save my name" disabled={!nameDraft.trim()} onPress={async () => {
                    const value = nameDraft.trim();
                    setName(value);
                    setPanel(null);
                    try {
                      await AsyncStorage.setItem(NAME_KEY, value);
                    } catch {
                      setNotice("Name updated for this session but could not be saved.");
                    }
                  }} />
                </View>
              </>
            )}

            {panel === "filters" && (
              <>
                <Text style={[s.label, { marginTop: 0 }]}>SORT TASKS BY</Text>
                <View style={s.wrap}>
                  {["Date", "Priority"].map((value) => (
                    <TouchableOpacity key={value} onPress={() => setSort(value)}
                      style={[s.chip, sort === value && s.selectedChip]}>
                      <Text style={[s.chipText, sort === value && { color: "white" }]}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[s.subtitle, { marginTop: 20, marginBottom: 24 }]}>
                  Use the chips beneath search to choose active, completed or high-priority tasks.
                </Text>
                <Button title="Apply my view" onPress={() => setPanel(null)} />
              </>
            )}

            {panel === "menu" && (
              <>
                <View style={s.menuSummary}>
                  <Text style={s.menuPercent}>{overall}%</Text>
                  <Text style={{ color: "#E4D9FF", fontSize: 12, marginTop: 5 }}>
                    {completed} of {tasks.length} tasks completed
                  </Text>
                </View>
                {[
                  ["home-outline", "My dashboard", () => setScreen("home")],
                  ["albums-outline", "All my plans", () => setScreen("tasks")],
                  ["calendar-outline", "Choose a day", () => openCalendar("day")],
                  ["person-outline", "Edit my name", () => { setNameDraft(name); setPanel("profile"); }],
                ].map(([icon, text, action]) => (
                  <TouchableOpacity key={text} style={s.menuRow} onPress={() => { setPanel(null); action(); }}>
                    <View style={s.categoryIcon}><Icon name={icon} size={17} /></View>
                    <Text style={{ color: C.ink, flex: 1, fontSize: 14 }}>{text}</Text>
                    <Icon name="chevron-forward" size={16} color={C.muted} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {panel === "delete" && (
              <>
                <Text style={[s.subtitle, { marginBottom: 24 }]}>This permanently removes the task and its subtasks.</Text>
                <Button title="Delete task" onPress={() => {
                  setTasks((current) => current.filter((task) => task.id !== selectedId));
                  setPanel(null);
                  setSelectedId(null);
                  setScreen("home");
                }} />
                <View style={{ marginTop: 12 }}><Button title="Keep my task" light onPress={() => setPanel(null)} /></View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  app: {
    flex: 1, width: "100%", maxWidth: 640, alignSelf: "center",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  content: { paddingHorizontal: 23, paddingTop: 15, paddingBottom: 30 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inline: { flexDirection: "row", alignItems: "center", gap: 7 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconButton: {
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: 15, backgroundColor: C.lavender,
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: { width: 35, height: 35, borderRadius: 12, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  logoText: { color: C.ink, fontSize: 25, fontWeight: "800", letterSpacing: -1 },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#FBE3D9", borderWidth: 3, borderColor: "white", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#A65B43", fontWeight: "800", fontSize: 16 },
  overline: { color: C.purple, fontSize: 9, fontWeight: "800", letterSpacing: 1.8 },
  greeting: { color: C.ink, fontSize: 32, fontWeight: "800", marginTop: 8, letterSpacing: -1 },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 22, marginTop: 6 },
  momentum: { backgroundColor: C.dark, borderRadius: 23, padding: 20, paddingBottom: 18, marginTop: 23, position: "relative" },
  momentumIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center", marginRight: 3 },
  momentumTitle: { fontSize: 13, color: "white", fontWeight: "700", paddingRight: 40 },
  momentumCopy: { fontSize: 10, color: "#CFC1EB", marginTop: 5 },
  momentumPercent: { position: "absolute", right: 19, top: 22, backgroundColor: "#FFFFFF12", paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11 },
  momentumPercentText: { color: "#FFD7BB", fontSize: 13, fontWeight: "800" },
  momentumTrack: { height: 5, backgroundColor: "#FFFFFF18", borderRadius: 5, marginTop: 18, overflow: "hidden" },
  momentumFill: { height: 5, borderRadius: 5, backgroundColor: "#D5B9FF" },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 18, paddingLeft: 16, paddingRight: 7, marginTop: 23, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, color: C.ink, fontSize: 12, paddingHorizontal: 10, paddingVertical: 16 },
  searchFilter: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFF0EC", alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, paddingTop: 13, paddingBottom: 3 },
  chip: { backgroundColor: C.lavender, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 13 },
  selectedChip: { backgroundColor: C.purple },
  chipText: { color: "#74618F", fontSize: 11, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 27, marginBottom: 16 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  tiny: { color: C.muted, fontSize: 10, lineHeight: 16 },
  miniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.purple },
  featureCard: { padding: 20, borderRadius: 24, backgroundColor: "white", borderWidth: 1, borderColor: C.border, shadowColor: "#554077", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  featureCategory: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F1ECFC", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  featureCategoryText: { color: C.purple, fontSize: 10, fontWeight: "700" },
  deadlineBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF0E9", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  deadlineText: { fontSize: 9, fontWeight: "700", color: "#AE5548" },
  featureTitle: { color: C.ink, fontSize: 22, fontWeight: "800", lineHeight: 29, letterSpacing: -0.6, marginTop: 18 },
  featureDescription: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  rocketArt: { width: 103, height: 126, alignItems: "center", justifyContent: "center" },
  orbit: { position: "absolute", width: 95, height: 95, borderRadius: 48, backgroundColor: "#F0EAFE" },
  innerOrbit: { position: "absolute", width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: "#DECEFB" },
  artStar: { position: "absolute", top: 7, right: 2 },
  artFlame: { position: "absolute", bottom: 4, left: 30 },
  largeArt: { width: 210, height: 220 },
  largeOrbit: { width: 190, height: 190, borderRadius: 95, backgroundColor: "#FFFFFF09" },
  largeInnerOrbit: { width: 155, height: 155, borderRadius: 78, borderColor: "#FFFFFF18" },
  progressLabel: { color: C.purple, fontSize: 12, fontWeight: "800" },
  progressTrack: { height: 6, backgroundColor: C.lavender, borderRadius: 6, overflow: "hidden", marginTop: 10 },
  progressFill: { height: 6, backgroundColor: C.violet, borderRadius: 6 },
  emptyFeature: { padding: 26, backgroundColor: "white", borderRadius: 23, alignItems: "center", borderWidth: 1, borderColor: C.border },
  emptyIcon: { padding: 15, backgroundColor: C.lavender, borderRadius: 19, marginBottom: 5 },
  coralLink: { color: "#B75347", fontWeight: "700", fontSize: 11 },
  week: { flexDirection: "row", gap: 5, marginBottom: 22 },
  weekDay: { flex: 1, alignItems: "center", paddingVertical: 11, backgroundColor: "white", borderRadius: 15, borderWidth: 1, borderColor: C.border },
  selectedDay: { backgroundColor: C.purple, borderColor: C.purple },
  weekLabel: { color: C.muted, fontSize: 10 },
  weekNumber: { color: C.ink, fontSize: 17, fontWeight: "800", marginTop: 7 },
  timelineRow: { flexDirection: "row", gap: 12, minHeight: 120 },
  rail: { width: 12, alignItems: "center", paddingTop: 23 },
  railDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#B49AE5", backgroundColor: C.bg },
  railLine: { width: 1, backgroundColor: "#E0D7EE", flex: 1, marginTop: 5 },
  taskCard: { flex: 1, backgroundColor: "white", borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  taskHighlight: { backgroundColor: C.purple, borderColor: C.purple, shadowColor: C.purple, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 2 },
  categoryIcon: { width: 27, height: 27, borderRadius: 9, backgroundColor: C.lavender, alignItems: "center", justifyContent: "center" },
  categoryText: { color: C.purple, fontSize: 10, fontWeight: "600" },
  taskTitle: { color: C.ink, fontSize: 17, fontWeight: "700", lineHeight: 24, marginTop: 7 },
  taskNote: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  priorityBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  empty: { alignItems: "center", paddingVertical: 25, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#635575", marginTop: 13, textAlign: "center" },
  emptyCopy: { fontSize: 12, color: C.muted, marginTop: 7, textAlign: "center", lineHeight: 20 },
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: "white" },
  navItem: { alignItems: "center", gap: 5, paddingHorizontal: 6 },
  navLabel: { fontSize: 9, color: C.muted, fontWeight: "600" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.coral, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18 },
  addText: { color: "white", fontSize: 12, fontWeight: "800" },
  button: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: C.purple, paddingVertical: 17, paddingHorizontal: 16, borderRadius: 17 },
  lightButton: { backgroundColor: C.lavender },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
  welcome: { alignItems: "center", paddingTop: 18, paddingBottom: 20 },
  welcomeArt: { height: 300, width: "100%", maxWidth: 350, alignItems: "center", justifyContent: "center", marginTop: 26 },
  welcomeHalo: { position: "absolute", width: 265, height: 265, borderRadius: 133, backgroundColor: "#EAE2FA" },
  welcomePlanet: { width: 230, height: 230, borderRadius: 115, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  floatLeft: { position: "absolute", left: 0, top: 32, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "white", borderRadius: 17, padding: 13, elevation: 3, shadowColor: "#553E80", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12 },
  floatRight: { position: "absolute", right: 0, bottom: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "white", borderRadius: 16, padding: 14, elevation: 3, shadowColor: "#553E80", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 5 }, shadowRadius: 12 },
  mintIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#E5F4EE", alignItems: "center", justifyContent: "center" },
  floatTitle: { color: "#57476C", fontSize: 11, fontWeight: "800" },
  floatCaption: { color: C.muted, fontSize: 9, marginTop: 4 },
  eyebrowPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.lavender, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, marginTop: 12 },
  eyebrow: { color: C.purple, fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  welcomeTitle: { color: C.ink, fontSize: 32, lineHeight: 42, letterSpacing: -1, fontWeight: "800", textAlign: "center", marginTop: 20 },
  welcomeCopy: { color: C.muted, fontSize: 13, lineHeight: 23, textAlign: "center", maxWidth: 290, marginTop: 15 },
  pageTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  formIntro: { padding: 21, backgroundColor: "#EEE7FB", borderRadius: 22, marginBottom: 3 },
  formIntroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#FFFFFF99", alignItems: "center", justifyContent: "center", marginBottom: 15 },
  formHeading: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.8 },
  label: { fontSize: 10, color: "#796B8A", fontWeight: "800", letterSpacing: 1, marginTop: 25, marginBottom: 11 },
  input: { backgroundColor: "white", padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#E6DFEF", color: C.ink, fontSize: 13 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.lavender, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  priorityOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: C.border },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "white", padding: 16, borderRadius: 14, marginTop: 9, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  error: { fontSize: 13, color: "#BC405A", marginTop: 17, lineHeight: 21 },
  detailHero: { backgroundColor: "white", padding: 22, borderRadius: 24, borderWidth: 1, borderColor: C.border },
  detailTitle: { color: C.ink, fontSize: 28, fontWeight: "800", lineHeight: 37, letterSpacing: -0.6, marginTop: 24 },
  detailCopy: { color: C.muted, fontSize: 13, lineHeight: 24, marginTop: 13 },
  detailInfo: { gap: 16, padding: 17, backgroundColor: "#F8F5FD", borderRadius: 17, marginTop: 22 },
  detailValue: { color: "#685778", fontSize: 12, flexShrink: 1 },
  deleteButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 21 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(32,21,51,0.48)" },
  modal: { width: "100%", maxWidth: 400, backgroundColor: "white", borderRadius: 25, padding: 23 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.2857%", height: 43, alignItems: "center", justifyContent: "center" },
  dayBubble: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuSummary: { backgroundColor: C.dark, padding: 22, borderRadius: 19, marginBottom: 13 },
  menuPercent: { color: "#FFD4B3", fontSize: 34, fontWeight: "800" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  warning: { padding: 13, backgroundColor: "#FFF0D9", color: "#94651C", borderRadius: 12, marginBottom: 16, lineHeight: 21 },
});