<script lang="ts">
  import * as Card from '$lib/components/ui/card';
</script>

<svelte:head>
  <title>À propos — ViteMonProf</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-12">
  <h1 class="mb-8 text-4xl font-bold">About ViteMonProf</h1>

  <Card.Root class="space-y-6">
    <Card.Content class="space-y-6 pt-8">
      <section>
        <h2 class="mb-4 text-2xl font-bold">Our Mission</h2>
        <p class="text-gray-700">
          ViteMonProf helps students track missed class hours due to cancellations. Our goal is to
          provide transparency about how much instructional time is being lost and help students and
          administrators identify patterns across their schools.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">How It Works</h2>
        <ol class="list-inside list-decimal space-y-2 text-gray-700">
          <li>Click on your school on the interactive map</li>
          <li>Log a missed class or cancelled session</li>
          <li>Include the class name and time of the incident</li>
          <li>View statistics and patterns to identify trends at your school</li>
        </ol>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Features</h2>
        <ul class="list-inside list-disc space-y-2 text-gray-700">
          <li>Interactive map for easy school selection</li>
          <li>Quick logging of missed class hours</li>
          <li>Statistical dashboard with trends and insights</li>
          <li>Comprehensive tracking across all schools</li>
          <li>Identify patterns in class cancellations</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Contact Us</h2>
        <p class="text-gray-700">
          Have questions or feedback? We'd love to hear from you. Send us an email or fill out our
          contact form.
        </p>
      </section>
    </Card.Content>
  </Card.Root>
</div>
