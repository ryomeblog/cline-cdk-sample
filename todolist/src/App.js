import { useState } from 'react';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTask !== null) {
      // 編集モード
      setTasks(tasks.map((task, index) => 
        index === editingTask ? { ...newTask } : task
      ));
      setEditingTask(null);
    } else {
      // 新規追加モード
      setTasks([...tasks, { ...newTask }]);
    }
    setNewTask({ title: '', description: '', priority: 'medium' });
    setShowForm(false);
  };

  const startEdit = (index) => {
    setEditingTask(index);
    setNewTask(tasks[index]);
    setShowForm(true);
  };

  const deleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  return (
    <div className="App">
      <h1>ToDoリスト</h1>
      
      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? 'フォームを閉じる' : '新しいタスクを追加'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="task-form">
          <div>
            <label>
              タスク名:
              <input
                type="text"
                name="title"
                value={newTask.title}
                onChange={handleInputChange}
                required
              />
            </label>
          </div>
          <div>
            <label>
              タスク内容:
              <textarea
                name="description"
                value={newTask.description}
                onChange={handleInputChange}
                required
              />
            </label>
          </div>
          <div>
            <label>
              優先度:
              <select
                name="priority"
                value={newTask.priority}
                onChange={handleInputChange}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>
          <button type="submit">
            {editingTask !== null ? '更新' : '追加'}
          </button>
        </form>
      )}

      <div className="task-list">
        {tasks.map((task, index) => (
          <div key={index} className={`task-card priority-${task.priority}`}>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
            <p>優先度: {
              task.priority === 'high' ? '高' :
              task.priority === 'medium' ? '中' : '低'
            }</p>
            <div className="task-actions">
              <button onClick={() => startEdit(index)}>編集</button>
              <button onClick={() => deleteTask(index)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
