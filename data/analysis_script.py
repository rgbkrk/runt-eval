#!/usr/bin/env python3
"""
Sample analysis script for mounting demo
"""

import pandas as pd
import numpy as np

def analyze_employee_data(df):
    """
    Perform basic analysis on employee data
    """
    results = {
        'total_employees': len(df),
        'average_age': float(df['age'].mean()),
        'average_salary': float(df['salary'].mean()),
        'departments': df['department'].unique().tolist(),
        'cities': df['city'].unique().tolist(),
        'salary_by_dept': df.groupby('department')['salary'].mean().to_dict(),
        'age_by_dept': df.groupby('department')['age'].mean().to_dict()
    }
    
    return results

def generate_report(df, results):
    """
    Generate a text report from analysis results
    """
    report = f"""
EMPLOYEE ANALYSIS REPORT
========================

Summary Statistics:
- Total Employees: {results['total_employees']}
- Average Age: {results['average_age']:.1f} years
- Average Salary: ${results['average_salary']:,.0f}

Departments: {', '.join(results['departments'])}
Cities: {', '.join(results['cities'])}

Salary by Department:
"""
    
    for dept, salary in results['salary_by_dept'].items():
        report += f"- {dept}: ${salary:,.0f}\n"
    
    report += "\nAge by Department:\n"
    for dept, age in results['age_by_dept'].items():
        report += f"- {dept}: {age:.1f} years\n"
    
    return report

if __name__ == "__main__":
    print("Analysis script loaded successfully!")
    print("Use analyze_employee_data(df) to analyze employee data")
    print("Use generate_report(df, results) to create a report")
