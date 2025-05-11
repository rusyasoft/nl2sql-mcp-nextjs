CREATE TABLE projects (
    project_id INT PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    status VARCHAR(20) CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')),
    department_id INT,
    project_manager_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (project_manager_id) REFERENCES employees(employee_id)
);

CREATE TABLE employee_projects (
    employee_id INT,
    project_id INT,
    role VARCHAR(50),
    assignment_date DATE,
    hours_allocated INT,
    PRIMARY KEY (employee_id, project_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
