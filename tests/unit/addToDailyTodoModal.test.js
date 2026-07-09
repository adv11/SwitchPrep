import { describe, it, expect, beforeEach } from 'vitest';
import { openAddToDailyTodoModal } from '../../src/ui/components/addToDailyTodoModal.js';
import { MAX_TODO_TITLE_LENGTH } from '../../src/core/dailyTodo/limits.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('openAddToDailyTodoModal', () => {
  it('pre-fills the title with the topic title', async () => {
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' });
    const titleInput = document.querySelector('.modal-overlay input.field-input');
    expect(titleInput.value).toBe('Semantic HTML');
    document.querySelector('.modal-overlay .btn-secondary').click();
    await promise;
  });

  it('resolves { title, durationMs } on submit with the default preset', async () => {
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' });
    document.querySelector('.modal-overlay form').requestSubmit();
    const result = await promise;
    expect(result.title).toBe('Semantic HTML');
    expect(result.durationMs).toBe(24 * 60 * 60 * 1000);
  });

  it('resolves null on cancel', async () => {
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' });
    document.querySelector('.modal-overlay .btn-secondary').click();
    expect(await promise).toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await promise).toBeNull();
  });

  it('shows a validation message and does not resolve for an empty title', async () => {
    let resolved = false;
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' }).then(() => { resolved = true; });
    document.querySelector('.modal-overlay input.field-input').value = '   ';
    document.querySelector('.modal-overlay form').requestSubmit();
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(document.querySelector('.form-message').textContent).toContain('title');
    document.querySelector('.modal-overlay .btn-secondary').click();
    await promise;
  });

  it('rejects a title over the max length', async () => {
    let resolved = false;
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' }).then(() => { resolved = true; });
    document.querySelector('.modal-overlay input.field-input').value = 'x'.repeat(MAX_TODO_TITLE_LENGTH + 1);
    document.querySelector('.modal-overlay form').requestSubmit();
    await Promise.resolve();
    expect(resolved).toBe(false);
    document.querySelector('.modal-overlay .btn-secondary').click();
    await promise;
  });

  it('switching to Custom and entering hours resolves the matching durationMs', async () => {
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' });
    const select = document.querySelector('.modal-overlay .todo-duration-select');
    select.value = 'custom';
    select.dispatchEvent(new Event('change'));
    document.querySelector('.modal-overlay .todo-custom-hours').value = '5';
    document.querySelector('.modal-overlay form').requestSubmit();
    const result = await promise;
    expect(result.durationMs).toBe(5 * 3600000);
  });

  it('rejects an empty custom-hours value', async () => {
    let resolved = false;
    const promise = openAddToDailyTodoModal({ topicTitle: 'Semantic HTML' }).then(() => { resolved = true; });
    const select = document.querySelector('.modal-overlay .todo-duration-select');
    select.value = 'custom';
    select.dispatchEvent(new Event('change'));
    document.querySelector('.modal-overlay form').requestSubmit();
    await Promise.resolve();
    expect(resolved).toBe(false);
    document.querySelector('.modal-overlay .btn-secondary').click();
    await promise;
  });
});
