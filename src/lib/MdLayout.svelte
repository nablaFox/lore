<script lang="ts">
  import type { Snippet } from 'svelte'
	import { onMount } from 'svelte'

	const {
		title,
		rtime,
		github,
		description,
    author,
		sections,
    ...rest
	}: {
    author: string
		title: string
		rtime: number
		github: string
		description: Snippet
		sections: { title: string; code: string; rtime: number }[]
    [key: string]: unknown
	} = $props()

	let current = $state(0)

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = sections.findIndex((s) => s.title.toLowerCase() === entry.target.id)
						if (index !== -1) current = index
					}
				}
			},
			{ rootMargin: '-20% 0px -60% 0px' }
		)

		for (const { title } of sections) {
			const el = document.getElementById(title.toLowerCase())

			if (el) observer.observe(el)
		}

		return () => observer.disconnect()
	})
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />

	<link
		href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,200..900;1,200..900&display=swap"
		rel="stylesheet"
	/>
  <title>{title}</title>
</svelte:head>

<div class="flex min-h-screen justify-center">
	<nav
		class="sticky top-0 hidden h-screen shrink-0 flex-col justify-center gap-4 px-8 md:flex lg:px-15"
	>
		<span class="uppercase">Contents</span>

		<ul class="space-y-4">
			{#each sections as { title, rtime }, i (i)}
				{@const isCurrent = i == current}
				{@const isVisited = i <= current}

				<li>
					<a
						class="flex items-center gap-2"
						href="#{title.toLowerCase()}"
						onclick={() => (current = i)}
					>
						<span class="relative">
							<span
								class={[
									'block size-2 rounded-full transition-colors duration-500',
									isVisited ? 'bg-accent' : 'bg-muted'
								]}
							>
							</span>

							{#if i < sections.length - 1}
								<span class="absolute top-full left-1/2 h-8 w-px -translate-x-1/2">
									<span class="absolute inset-0 bg-muted"></span>
									<span
										class={[
											'absolute inset-0 bg-accent transition-opacity duration-700',
											i < current ? 'opacity-100' : 'opacity-0'
										]}
									></span>
								</span>
							{/if}
						</span>

						<span
							class:text-muted={!isVisited && !isCurrent}
							class="max-w-40 truncate font-medium transition-colors duration-300 hover:text-accent"
						>
							{title}
						</span>

						<span class="text-xs text-muted/80">{rtime}m</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

  <div class="sticky top-0 h-screen w-px shrink-0 bg-linear-to-b from-transparent via-border to-transparent"></div>

	<div class="w-full max-w-200 p-6 sm:p-8 lg:p-15 markdown min-w-0">
    <header class="mb-5">
      <h1 class="text-3xl font-bold">{title}</h1>

      <p class="mt-2 text-sm text-muted">
        {rtime} min read · {author} · <a href="https://github.com/{github}">GitHub</a> 
      </p>

      {#if description}
        <div class="mt-3">
          {@render description()}
        </div>
      {/if}
    </header>

    <main class="pb-40">
      {#each sections as { title, rtime }, i (i)}
        <h2 class="mb-4 font-bold text-2xl">{title}</h2>

        <section id={title.toLowerCase()} class="not-last:mb-5 scroll-mt-16">
          {@render (rest[`section_${i}`] as Snippet | undefined)?.()}
        </section>
      {/each}
    </main>
	</div>
</div>

<style>
  :global(.markdown main section p:not(:last-child)) {
    margin-bottom: 1rem;
  }

  :global(.markdown main section img:not(:last-child)) {
    margin-bottom: 1rem;
  }

  :global(.markdown main section ul),
  :global(.markdown main section ol) {
    padding-left: 1.5rem;
  }

  :global(.markdown main section ul) {
    list-style: disc;
  }

  :global(.markdown main section ol) {
    list-style: decimal;
  }

  :global(.markdown main section ul:not(:last-child)),
  :global(.markdown main section ol:not(:last-child)) {
    margin-bottom: 1rem;
  }

  :global(.markdown main section ul li::marker),
  :global(.markdown main section ol li::marker) {
    color: var(--color-muted);
  }

  :global(.markdown a) {
    color: var(--color-accent);
  }

  :global(.markdown main section pre) {
    background-color: color-mix(in srgb, var(--color-accent) 10%, transparent);
    border-radius: 0.375rem;
    padding: 0.75rem;
    overflow-x: auto;
  }

  :global(.markdown main section pre:not(:last-child)) {
    margin-bottom: 1rem;
  }

  :global(.markdown main section pre code) {
    background: none;
    padding: 0;
    font-size: 0.875rem;
  }
</style>
